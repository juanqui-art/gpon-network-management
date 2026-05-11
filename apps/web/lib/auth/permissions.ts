import { notFound } from "next/navigation";
import { getUserRoleFromMetadata } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/gpon";

export function canManageUsers(role: UserRole | null | undefined): boolean {
	return role === "admin";
}

export async function requireAdmin() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const role = getUserRoleFromMetadata(
		user?.app_metadata as Record<string, unknown> | null | undefined,
	);

	if (!user || !canManageUsers(role)) {
		notFound();
	}

	return { user, role };
}
