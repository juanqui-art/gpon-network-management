import { signOut } from "@/app/actions/auth";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex h-full flex-col">
			<header className="flex h-12 shrink-0 items-center justify-between border-b border-[rgba(164,164,164,0.18)] bg-[#222324] px-4">
				<span className="text-sm font-semibold text-[#e6e6e6]">
					GPON Network
				</span>
				<form action={signOut}>
					<button
						type="submit"
						className="rounded px-2 py-1 text-sm text-[#a4a4a4] transition-colors hover:bg-[#303133] hover:text-[#e6e6e6]"
					>
						Salir
					</button>
				</form>
			</header>
			<main className="flex-1 overflow-hidden">{children}</main>
		</div>
	);
}
