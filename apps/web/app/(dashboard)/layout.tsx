import Link from "next/link";
import { signOut } from "@/app/actions/auth";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex h-full flex-col">
			<header className="flex h-12 shrink-0 items-center justify-between border-b border-[rgba(164,164,164,0.18)] bg-[#222324] px-4">
				<div className="flex items-center gap-6">
					<Link
						href="/networks"
						className="text-sm font-semibold text-[#e6e6e6] transition-colors hover:text-white"
					>
						◈ GPON
					</Link>
					<nav className="flex items-center gap-1">
						<Link
							href="/networks"
							className="rounded px-2.5 py-1 text-xs text-[#a4a4a4] transition-colors hover:bg-[#303133] hover:text-[#e6e6e6]"
						>
							Redes
						</Link>
					</nav>
				</div>
				<form action={signOut}>
					<button
						type="submit"
						className="rounded px-2 py-1 text-xs text-[#a4a4a4] transition-colors hover:bg-[#303133] hover:text-[#e6e6e6]"
					>
						Salir
					</button>
				</form>
			</header>
			<main className="flex-1 overflow-auto">{children}</main>
		</div>
	);
}
