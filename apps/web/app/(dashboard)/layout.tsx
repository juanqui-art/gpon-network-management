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
		</div>
	);
}
