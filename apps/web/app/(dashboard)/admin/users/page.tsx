import type { User } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/permissions";
import { getUserRoleFromMetadata } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { type AdminUserView, UsersClient } from "./users-client";

export const metadata = { title: "Usuarios y roles" };

function toUserView(user: User, currentUserId: string): AdminUserView {
	return {
		id: user.id,
		email: user.email ?? "Sin email",
		role: getUserRoleFromMetadata(
			user.app_metadata as Record<string, unknown> | null | undefined,
		),
		createdAt: user.created_at,
		lastSignInAt: user.last_sign_in_at ?? null,
		emailConfirmedAt: user.email_confirmed_at ?? null,
		bannedUntil: user.banned_until ?? null,
		isCurrentUser: user.id === currentUserId,
	};
}

export default async function AdminUsersPage() {
	const { user: currentUser } = await requireAdmin();
	const admin = createAdminClient();
	const { data, error } = await admin.auth.admin.listUsers({
		page: 1,
		perPage: 100,
	});

	if (error) {
		throw new Error(error.message);
	}

	const users = data.users
		.map((user) => toUserView(user, currentUser.id))
		.sort((a, b) => a.email.localeCompare(b.email));

	return <UsersClient users={users} />;
}
