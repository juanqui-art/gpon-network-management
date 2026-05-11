import type { User } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/permissions";
import { getUserRoleFromMetadata } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { type AdminUserView, UsersClient } from "./users-client";

export const metadata = { title: "Usuarios y roles" };

// Formatted server-side so the SSR HTML matches the hydrated tree.
// Intl.DateTimeFormat output differs slightly between Node and the browser
// (e.g., NBSP vs NARROW NO-BREAK SPACE around "p. m."), so deferring formatting
// to the client would trigger hydration mismatches.
const dateFormatter = new Intl.DateTimeFormat("es-EC", {
	dateStyle: "medium",
	timeStyle: "short",
});

function formatDate(value: string | null): string {
	if (!value) return "Sin registro";
	return dateFormatter.format(new Date(value));
}

function toUserView(user: User, currentUserId: string): AdminUserView {
	const lastSignIn = user.last_sign_in_at ?? null;
	return {
		id: user.id,
		email: user.email ?? "Sin email",
		role: getUserRoleFromMetadata(
			user.app_metadata as Record<string, unknown> | null | undefined,
		),
		createdAt: user.created_at,
		createdAtLabel: formatDate(user.created_at),
		lastSignInAt: lastSignIn,
		lastSignInAtLabel: formatDate(lastSignIn),
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
