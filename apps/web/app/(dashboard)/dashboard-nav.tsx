"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
	{ href: "/dashboard", label: "Dashboard" },
	{ href: "/networks", label: "Redes" },
	{ href: "/map", label: "Mapa" },
	{ href: "/monitoring", label: "Monitoreo" },
	{ href: "/admin/users", label: "Usuarios" },
	{ href: "/admin/audit", label: "Auditoría" },
	{ href: "/admin/settings", label: "Settings" },
] as const;

function isActive(pathname: string, href: string): boolean {
	if (href === "/dashboard") return pathname === "/dashboard";
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
	const [open, setOpen] = useState(false);
	const pathname = usePathname();

	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname from usePathname is reactive; close menu on route change
	useEffect(() => {
		setOpen(false);
	}, [pathname]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	return (
		<header className="relative z-30 flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
			<div className="flex items-center gap-6">
				<Link
					href="/dashboard"
					className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
				>
					GPON
				</Link>
				<nav className="hidden items-center gap-1 md:flex">
					{NAV_LINKS.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className={`rounded-md px-2.5 py-1 text-xs transition-colors hover:bg-muted hover:text-foreground ${
								isActive(pathname, link.href)
									? "bg-muted text-foreground"
									: "text-muted-foreground"
							}`}
						>
							{link.label}
						</Link>
					))}
				</nav>
			</div>

			<form action={signOut} className="hidden md:block">
				<Button type="submit" variant="ghost" size="sm">
					Salir
				</Button>
			</form>

			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-label={open ? "Cerrar menú" : "Abrir menú"}
				aria-expanded={open}
				aria-controls="dashboard-mobile-nav"
				className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
			>
				{open ? (
					<X className="size-5" aria-hidden="true" />
				) : (
					<Menu className="size-5" aria-hidden="true" />
				)}
			</button>

			{open && (
				<>
					<button
						type="button"
						aria-label="Cerrar menú"
						onClick={() => setOpen(false)}
						className="fixed inset-0 top-12 z-20 bg-black/40 backdrop-blur-sm md:hidden"
					/>
					<div
						id="dashboard-mobile-nav"
						className="absolute inset-x-0 top-full z-30 border-b border-border bg-card shadow-lg md:hidden"
					>
						<nav className="flex flex-col gap-1 px-3 py-3">
							{NAV_LINKS.map((link) => (
								<Link
									key={link.href}
									href={link.href}
									className={`rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-muted hover:text-foreground ${
										isActive(pathname, link.href)
											? "bg-muted text-foreground"
											: "text-muted-foreground"
									}`}
								>
									{link.label}
								</Link>
							))}
							<form action={signOut} className="border-t border-border pt-2">
								<Button
									type="submit"
									variant="ghost"
									className="w-full justify-start"
								>
									Salir
								</Button>
							</form>
						</nav>
					</div>
				</>
			)}
		</header>
	);
}
