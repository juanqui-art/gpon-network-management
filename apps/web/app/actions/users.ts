"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/log";
import { requireAdmin } from "@/lib/auth/permissions";
import {
	checkAdminInviteRateLimit,
	checkAdminWriteRateLimit,
} from "@/lib/auth/rate-limit";
import { getUserRoleFromMetadata, USER_ROLES } from "@/lib/auth/roles";
import { translateAuthError } from "@/lib/auth/supabase-errors";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types/gpon";

export interface UserActionState {
	status: "idle" | "success" | "error";
	message: string | null;
}

const initialState: UserActionState = {
	status: "idle",
	message: null,
};

function readRole(formData: FormData): UserRole | null {
	const role = formData.get("role");
	if (!USER_ROLES.includes(role as UserRole)) return null;
	return role as UserRole;
}

function userPath() {
	return "/admin/users";
}

function formatRetry(seconds: number): string {
	if (seconds < 60) return `${seconds} segundos`;
	const minutes = Math.ceil(seconds / 60);
	return `${minutes} minuto${minutes === 1 ? "" : "s"}`;
}

function isUserBanned(bannedUntil: string | null | undefined): boolean {
	if (!bannedUntil) return false;
	return new Date(bannedUntil).getTime() > Date.now();
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function setUserAppRole(
	admin: AdminClient,
	userId: string,
	previousMetadata: Record<string, unknown> | null | undefined,
	role: UserRole,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
	const base = (previousMetadata ?? {}) as Record<string, unknown>;
	for (let attempt = 0; attempt < 2; attempt++) {
		const { error } = await admin.auth.admin.updateUserById(userId, {
			app_metadata: { ...base, role },
		});
		if (!error) return { ok: true };
		if (attempt === 0) {
			await new Promise((resolve) => setTimeout(resolve, 250));
			continue;
		}
		return { ok: false, error };
	}
	return { ok: false, error: new Error("unreachable") };
}

// Deletes the target user's session rows so they cannot refresh their JWT.
// Their current access token stays valid until natural expiry (default 1h),
// after which they're forced to re-login and pick up the new role/ban state.
async function revokeUserSessions(
	admin: AdminClient,
	userId: string,
): Promise<boolean> {
	const { error } = await admin
		.schema("auth")
		.from("sessions")
		.delete()
		.eq("user_id", userId);
	if (error) {
		console.warn(
			`[admin/users] failed to revoke sessions for ${userId}`,
			error,
		);
		return false;
	}
	return true;
}

async function countActiveAdmins(): Promise<number> {
	const admin = createAdminClient();
	const { data, error } = await admin.auth.admin.listUsers({
		page: 1,
		perPage: 100,
	});
	if (error || !data) return 0;
	return data.users.filter((u) => {
		const role = getUserRoleFromMetadata(
			u.app_metadata as Record<string, unknown> | null | undefined,
		);
		return role === "admin" && !isUserBanned(u.banned_until ?? null);
	}).length;
}

export async function inviteUser(
	_: UserActionState = initialState,
	formData: FormData,
): Promise<UserActionState> {
	const { user: actor } = await requireAdmin();

	const email = String(formData.get("email") ?? "")
		.trim()
		.toLowerCase();
	const role = readRole(formData);

	if (!email) {
		return { status: "error", message: "Ingresa un email válido" };
	}
	if (!role) {
		return { status: "error", message: "Selecciona un rol válido" };
	}

	const limit = await checkAdminInviteRateLimit(actor.id);
	if (!limit.ok) {
		return {
			status: "error",
			message: `Demasiadas invitaciones. Inténtalo de nuevo en ${formatRetry(limit.retryAfterSeconds)}.`,
		};
	}

	const admin = createAdminClient();
	// Don't pass `data: { role }` — that would write to user_metadata, which
	// the user can edit themselves. Role lives in app_metadata only, set below.
	const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
		redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password`,
	});

	if (error || !data.user) {
		return {
			status: "error",
			message: translateAuthError(error, "No se pudo invitar al usuario"),
		};
	}

	const roleResult = await setUserAppRole(
		admin,
		data.user.id,
		data.user.app_metadata as Record<string, unknown> | null | undefined,
		role,
	);

	if (!roleResult.ok) {
		console.error(
			"[admin/users] inviteUser: role assignment failed after retry",
			{ userId: data.user.id, email: data.user.email, error: roleResult.error },
		);
		return {
			status: "error",
			message:
				"Invitación enviada pero el rol no se asignó. Editá el rol manualmente desde la tabla antes de que el usuario active su cuenta.",
		};
	}

	await writeAuditLog({
		actorUserId: actor.id,
		actorEmail: actor.email ?? null,
		action: "user.invited",
		targetType: "auth.user",
		targetId: data.user.id,
		targetLabel: data.user.email ?? email,
		metadata: { role },
	});

	revalidatePath(userPath());
	revalidatePath("/admin/audit");
	return { status: "success", message: "Invitación enviada" };
}

export async function updateUserRole(
	_: UserActionState = initialState,
	formData: FormData,
): Promise<UserActionState> {
	const { user: actor } = await requireAdmin();

	const userId = String(formData.get("userId") ?? "");
	const role = readRole(formData);
	if (!userId || !role) {
		return { status: "error", message: "Datos inválidos" };
	}

	if (userId === actor.id) {
		return {
			status: "error",
			message: "No puedes cambiar tu propio rol",
		};
	}

	const limit = await checkAdminWriteRateLimit(actor.id);
	if (!limit.ok) {
		return {
			status: "error",
			message: `Demasiadas operaciones. Inténtalo de nuevo en ${formatRetry(limit.retryAfterSeconds)}.`,
		};
	}

	const admin = createAdminClient();
	const { data, error } = await admin.auth.admin.getUserById(userId);
	if (error || !data.user) {
		return { status: "error", message: "Usuario no encontrado" };
	}

	const currentRole = getUserRoleFromMetadata(
		data.user.app_metadata as Record<string, unknown> | null | undefined,
	);

	if (currentRole === role) {
		return { status: "idle", message: null };
	}

	if (currentRole === "admin" && role !== "admin") {
		const remaining = await countActiveAdmins();
		if (remaining <= 1) {
			return {
				status: "error",
				message: "Debe permanecer al menos un administrador activo",
			};
		}
	}

	const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
		app_metadata: {
			...(data.user.app_metadata as Record<string, unknown>),
			role,
		},
	});

	if (updateError) {
		return { status: "error", message: "No se pudo actualizar el rol" };
	}

	const sessionsRevoked = await revokeUserSessions(admin, userId);

	await writeAuditLog({
		actorUserId: actor.id,
		actorEmail: actor.email ?? null,
		action: "user.role_updated",
		targetType: "auth.user",
		targetId: data.user.id,
		targetLabel: data.user.email ?? null,
		metadata: {
			previousRole: currentRole,
			nextRole: role,
			sessionsRevoked,
		},
	});

	revalidatePath(userPath());
	revalidatePath("/admin/audit");
	return {
		status: "success",
		message: sessionsRevoked
			? "Rol actualizado. Sesiones revocadas."
			: "Rol actualizado (no se pudieron revocar sesiones activas).",
	};
}

export async function setUserSuspended(
	_: UserActionState = initialState,
	formData: FormData,
): Promise<UserActionState> {
	const { user: currentUser } = await requireAdmin();

	const userId = String(formData.get("userId") ?? "");
	const action = String(formData.get("action") ?? "");
	if (!userId) {
		return { status: "error", message: "Datos inválidos" };
	}
	if (userId === currentUser.id) {
		return {
			status: "error",
			message: "No puedes suspender tu propia cuenta",
		};
	}
	if (action !== "suspend" && action !== "activate") {
		return { status: "error", message: "Acción inválida" };
	}

	const limit = await checkAdminWriteRateLimit(currentUser.id);
	if (!limit.ok) {
		return {
			status: "error",
			message: `Demasiadas operaciones. Inténtalo de nuevo en ${formatRetry(limit.retryAfterSeconds)}.`,
		};
	}

	const admin = createAdminClient();
	const { data } = await admin.auth.admin.getUserById(userId);
	const targetEmail = data.user?.email ?? null;

	if (action === "suspend" && data.user) {
		const targetRole = getUserRoleFromMetadata(
			data.user.app_metadata as Record<string, unknown> | null | undefined,
		);
		const targetActive = !isUserBanned(data.user.banned_until ?? null);
		if (targetRole === "admin" && targetActive) {
			const remaining = await countActiveAdmins();
			if (remaining <= 1) {
				return {
					status: "error",
					message: "Debe permanecer al menos un administrador activo",
				};
			}
		}
	}

	const { error } = await admin.auth.admin.updateUserById(userId, {
		ban_duration: action === "suspend" ? "876000h" : "none",
	});

	if (error) {
		return { status: "error", message: "No se pudo actualizar el estado" };
	}

	const sessionsRevoked =
		action === "suspend" ? await revokeUserSessions(admin, userId) : null;

	await writeAuditLog({
		actorUserId: currentUser.id,
		actorEmail: currentUser.email ?? null,
		action: action === "suspend" ? "user.suspended" : "user.reactivated",
		targetType: "auth.user",
		targetId: userId,
		targetLabel: targetEmail,
		metadata: { action, sessionsRevoked },
	});

	revalidatePath(userPath());
	revalidatePath("/admin/audit");
	if (action === "suspend") {
		return {
			status: "success",
			message: sessionsRevoked
				? "Usuario suspendido. Sesiones revocadas."
				: "Usuario suspendido (no se pudieron revocar sesiones activas).",
		};
	}
	return { status: "success", message: "Usuario reactivado" };
}

export async function resendInvitation(
	_: UserActionState = initialState,
	formData: FormData,
): Promise<UserActionState> {
	const { user: actor } = await requireAdmin();

	const userId = String(formData.get("userId") ?? "");
	if (!userId) return { status: "error", message: "Datos inválidos" };

	if (userId === actor.id) {
		return {
			status: "error",
			message: "No puedes reinvitarte a ti mismo",
		};
	}

	const limit = await checkAdminInviteRateLimit(actor.id);
	if (!limit.ok) {
		return {
			status: "error",
			message: `Demasiadas invitaciones. Inténtalo de nuevo en ${formatRetry(limit.retryAfterSeconds)}.`,
		};
	}

	const admin = createAdminClient();
	const { data, error } = await admin.auth.admin.getUserById(userId);
	if (error || !data.user || !data.user.email) {
		return { status: "error", message: "Usuario no encontrado" };
	}

	if (data.user.email_confirmed_at) {
		return {
			status: "error",
			message: "El usuario ya activó su cuenta. Usa reset de contraseña.",
		};
	}

	const role = getUserRoleFromMetadata(
		data.user.app_metadata as Record<string, unknown> | null | undefined,
	);
	// Role is already in app_metadata from the original invite; no need to
	// re-send it via `data` (which would write to user_metadata).
	const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
		data.user.email,
		{
			redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password`,
		},
	);

	if (inviteError) {
		return {
			status: "error",
			message: translateAuthError(
				inviteError,
				"No se pudo reenviar la invitación",
			),
		};
	}

	await writeAuditLog({
		actorUserId: actor.id,
		actorEmail: actor.email ?? null,
		action: "user.invitation_resent",
		targetType: "auth.user",
		targetId: data.user.id,
		targetLabel: data.user.email,
		metadata: { role },
	});

	revalidatePath(userPath());
	revalidatePath("/admin/audit");
	return { status: "success", message: "Invitación reenviada" };
}

export async function sendPasswordReset(
	_: UserActionState = initialState,
	formData: FormData,
): Promise<UserActionState> {
	const { user: actor } = await requireAdmin();

	const userId = String(formData.get("userId") ?? "");
	if (!userId) return { status: "error", message: "Datos inválidos" };

	const limit = await checkAdminWriteRateLimit(actor.id);
	if (!limit.ok) {
		return {
			status: "error",
			message: `Demasiadas operaciones. Inténtalo de nuevo en ${formatRetry(limit.retryAfterSeconds)}.`,
		};
	}

	const admin = createAdminClient();
	const { data, error } = await admin.auth.admin.getUserById(userId);
	if (error || !data.user || !data.user.email) {
		return { status: "error", message: "Usuario no encontrado" };
	}

	if (!data.user.email_confirmed_at) {
		return {
			status: "error",
			message: "El usuario aún no activó su cuenta. Usa reenviar invitación.",
		};
	}

	const { error: resetError } = await admin.auth.resetPasswordForEmail(
		data.user.email,
		{ redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password` },
	);

	if (resetError) {
		return {
			status: "error",
			message: translateAuthError(
				resetError,
				"No se pudo enviar el enlace de reset",
			),
		};
	}

	await writeAuditLog({
		actorUserId: actor.id,
		actorEmail: actor.email ?? null,
		action: "user.password_reset_sent",
		targetType: "auth.user",
		targetId: data.user.id,
		targetLabel: data.user.email,
	});

	revalidatePath(userPath());
	revalidatePath("/admin/audit");
	return { status: "success", message: "Enlace de reset enviado" };
}
