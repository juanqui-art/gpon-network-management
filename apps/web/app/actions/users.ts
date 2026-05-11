"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/log";
import { requireAdmin } from "@/lib/auth/permissions";
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

	const admin = createAdminClient();
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
	const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
		redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
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

export async function updateUserRole(formData: FormData): Promise<void> {
	const { user: actor } = await requireAdmin();

	const userId = String(formData.get("userId") ?? "");
	const role = readRole(formData);
	if (!userId || !role) return;

	const admin = createAdminClient();
	const { data, error } = await admin.auth.admin.getUserById(userId);
	if (error || !data.user) return;

	const currentRole = getUserRoleFromMetadata(
		data.user.app_metadata as Record<string, unknown> | null | undefined,
	);

	if (currentRole === role) return;

	const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
		app_metadata: {
			...(data.user.app_metadata as Record<string, unknown>),
			role,
		},
	});

	if (updateError) return;

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
}

export async function setUserSuspended(formData: FormData): Promise<void> {
	const { user: currentUser } = await requireAdmin();

	const userId = String(formData.get("userId") ?? "");
	const action = String(formData.get("action") ?? "");
	if (!userId || userId === currentUser.id) return;

	const admin = createAdminClient();
	const { data } = await admin.auth.admin.getUserById(userId);
	const targetEmail = data.user?.email ?? null;
	const { error } = await admin.auth.admin.updateUserById(userId, {
		ban_duration: action === "suspend" ? "876000h" : "none",
	});

	if (error) return;

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
}
