import { NavigationShortcuts } from "@/components/command/navigation-shortcuts";
import { CommandPalette } from "@/components/command/palette";
import { ShortcutsOverlay } from "@/components/command/shortcuts-overlay";
import { DashboardNav } from "./dashboard-nav";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex h-dvh min-h-0 flex-col">
			<DashboardNav />
			<main className="min-h-0 flex-1 overflow-hidden">{children}</main>
			<CommandPalette />
			<ShortcutsOverlay />
			<NavigationShortcuts />
		</div>
	);
}
