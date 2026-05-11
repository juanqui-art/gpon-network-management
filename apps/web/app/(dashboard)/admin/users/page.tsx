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

// Supabase default OTP TTL. Configurable per-project in Auth settings.
const INVITE_TTL_HOURS = 24;

function formatDate(value: string | null): string {
	if (!value) return "Sin registro";
	return dateFormatter.format(new Date(value));
}

function inviteStatus(confirmationSentAt: string | null): {
	sentLabel: string | null;
	expired: boolean | null;
} {
	if (!confirmationSentAt) return { sentLabel: null, expired: null };
	const sentMs = new Date(confirmationSentAt).getTime();
	const expiresMs = sentMs + INVITE_TTL_HOURS * 60 * 60 * 1000;
	return {
		sentLabel: dateFormatter.format(new Date(sentMs)),
		expired: Date.now() >= expiresMs,
	};
}

function toUserView(user: User, currentUserId: string): AdminUserView {
	const lastSignIn = user.last_sign_in_at ?? null;
	const invite = inviteStatus(user.confirmation_sent_at ?? null);
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
		invitationSentAtLabel: invite.sentLabel,
		invitationExpired: invite.expired,
		bannedUntil: user.banned_until ?? null,
		isCurrentUser: user.id === currentUserId,
	};
}

const PAGE_SIZE = 50;

export default async function AdminUsersPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string; q?: string }>;
}) {
	const { user: currentUser } = await requireAdmin();
	const { page: pageParam, q: queryParam } = await searchParams;

	const q = queryParam?.trim().toLowerCase() ?? "";
	const isSearch = q.length > 0;
	// In search mode fetch a large batch and filter; otherwise paginate.
	const page = isSearch ? 1 : Math.max(1, Number(pageParam) || 1);
	const perPage = isSearch ? 1000 : PAGE_SIZE;

	const admin = createAdminClient();
	const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

	if (error) {
		throw new Error(error.message);
	}

	const filtered = isSearch
		? data.users.filter((u) => (u.email ?? "").toLowerCase().includes(q))
		: data.users;

	const users = filtered
		.map((u) => toUserView(u, currentUser.id))
		.sort((a, b) => a.email.localeCompare(b.email));

	const hasNextPage = !isSearch && data.users.length === PAGE_SIZE;
	const hasPrevPage = !isSearch && page > 1;

	return (
		<UsersClient
			users={users}
			page={page}
			hasNextPage={hasNextPage}
			hasPrevPage={hasPrevPage}
			q={q}
		/>
	);
}
