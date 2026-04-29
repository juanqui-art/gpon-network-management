import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex h-full flex-col">
			<header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
				<div className="flex items-center gap-6">
					<Link
						href="/dashboard"
						className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
					>
						GPON
					</Link>
					<nav className="flex items-center gap-1">
						<Link
							href="/dashboard"
							className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							Dashboard
						</Link>
						<Link
							href="/networks"
							className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							Redes
						</Link>
						<Link
							href="/map"
							className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							Mapa
						</Link>
						<Link
							href="/admin/users"
							className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							Usuarios
						</Link>
						<Link
							href="/admin/audit"
							className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							Auditoría
						</Link>
						<Link
							href="/admin/settings"
							className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							Settings
						</Link>
					</nav>
				</div>
				<form action={signOut}>
					<Button type="submit" variant="ghost" size="sm">
						Salir
					</Button>
				</form>
			</header>
			<main className="flex-1 overflow-auto">{children}</main>
		</div>
	);
}
