import { NavigationShortcuts } from "@/components/command/navigation-shortcuts";
import { CommandPalette } from "@/components/command/palette";
import { ShortcutsOverlay } from "@/components/command/shortcuts-overlay";
import { getUserRoleFromMetadata } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "./dashboard-nav";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// Navigation is role-aware: links a role cannot open are not offered
	// (pages still enforce access server-side).
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	const role = getUserRoleFromMetadata(
		user?.app_metadata as Record<string, unknown> | null | undefined,
	);

	return (
		<div className="flex h-dvh min-h-0 flex-col">
			<DashboardNav role={role} email={user?.email ?? null} />
			<main className="min-h-0 flex-1 overflow-hidden">{children}</main>
			<CommandPalette isAdmin={role === "admin"} />
			<ShortcutsOverlay />
			<NavigationShortcuts />
		</div>
	);
}
