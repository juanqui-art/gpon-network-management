"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/log";
import { requireAdmin } from "@/lib/auth/permissions";
import {
	checkAdminInviteRateLimit,
	checkAdminWriteRateLimit,
} from "@/lib/auth/rate-limit";
import { getUserRoleFromMetadata, USER_ROLES } from "@/lib/auth/roles";
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

function siteUrl(): string {
	return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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
	const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
		redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
		data: { role },
	});

	if (error || !data.user) {
		return {
			status: "error",
			message: error?.message ?? "No se pudo invitar al usuario",
		};
	}

	const appMetadata = {
		...(data.user.app_metadata as Record<string, unknown>),
		role,
	};
	const { error: roleError } = await admin.auth.admin.updateUserById(
		data.user.id,
		{ app_metadata: appMetadata },
	);

	if (roleError) {
		return {
			status: "error",
			message: "Usuario invitado, pero no se pudo asignar el rol",
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

	await writeAuditLog({
		actorUserId: actor.id,
		actorEmail: actor.email ?? null,
		action: "user.role_updated",
		targetType: "auth.user",
		targetId: data.user.id,
		targetLabel: data.user.email ?? null,
		metadata: { previousRole: currentRole, nextRole: role },
	});

	revalidatePath(userPath());
	revalidatePath("/admin/audit");
	return { status: "success", message: "Rol actualizado" };
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

	await writeAuditLog({
		actorUserId: currentUser.id,
		actorEmail: currentUser.email ?? null,
		action: action === "suspend" ? "user.suspended" : "user.reactivated",
		targetType: "auth.user",
		targetId: userId,
		targetLabel: targetEmail,
		metadata: { action },
	});

	revalidatePath(userPath());
	revalidatePath("/admin/audit");
	return {
		status: "success",
		message: action === "suspend" ? "Usuario suspendido" : "Usuario reactivado",
	};
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
	const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
		data.user.email,
		{
			redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
			data: { role },
		},
	);

	if (inviteError) {
		return {
			status: "error",
			message: inviteError.message || "No se pudo reenviar la invitación",
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
		{ redirectTo: `${siteUrl()}/auth/callback?next=/reset-password` },
	);

	if (resetError) {
		return {
			status: "error",
			message: "No se pudo enviar el enlace de reset",
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
