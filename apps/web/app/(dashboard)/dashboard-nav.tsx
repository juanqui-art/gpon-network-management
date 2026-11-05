"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { AppDrawer } from "@/components/ui/app-drawer";
import { Button } from "@/components/ui/button";
import { homePathForRole, ROLE_LABELS } from "@/lib/auth/roles";
import { useModifierKey } from "@/lib/hooks/use-modifier-key";
import {
	isLeaveBlocked,
	requestNavigation,
} from "@/lib/navigation/leave-guard";
import type { UserRole } from "@/lib/types/gpon";

function openPalette() {
	window.dispatchEvent(new Event("gpon:palette"));
}

/** Sign-out drops in-memory editor state: route it through the leave guard. */
function guardSignOut(event: React.FormEvent<HTMLFormElement>) {
	if (!isLeaveBlocked("/login")) return;
	event.preventDefault();
	const form = event.currentTarget;
	void requestNavigation("/login", () => form.requestSubmit());
}

const MAIN_LINKS = [
	{ href: "/dashboard", label: "Inicio" },
	{ href: "/networks", label: "Redes" },
	{ href: "/map", label: "Mapa" },
	{ href: "/monitoring", label: "Monitoreo" },
] as const;

/** Admin-only (pages 404 for other roles): never offered to them. */
const ADMIN_LINKS = [
	{ href: "/admin/users", label: "Usuarios" },
	{ href: "/admin/audit", label: "Auditoría" },
	{ href: "/admin/settings", label: "Configuración" },
] as const;

type NavLink = { href: string; label: string };

function NavLinks({
	links,
	pathname,
	itemClassName,
}: {
	links: readonly NavLink[];
	pathname: string;
	itemClassName: string;
}) {
	return links.map((link) => {
		const active = isActive(pathname, link.href);
		return (
			<Link
				key={link.href}
				href={link.href}
				aria-current={active ? "page" : undefined}
				className={`${itemClassName} transition-colors hover:bg-muted hover:text-fg ${
					active ? "bg-muted text-fg" : "text-fg-muted"
				}`}
			>
				{link.label}
			</Link>
		);
	});
}

function isActive(pathname: string, href: string): boolean {
	if (href === "/dashboard") return pathname === "/dashboard";
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav({
	role,
	email,
}: {
	role: UserRole;
	email: string | null;
}) {
	const isAdmin = role === "admin";
	const [open, setOpen] = useState(false);
	const pathname = usePathname();
	const modifierKey = useModifierKey();
	const paletteShortcut = modifierKey === "⌘" ? "⌘K" : "Ctrl K";

	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname from usePathname is reactive; close menu on route change
	useEffect(() => {
		setOpen(false);
	}, [pathname]);

	return (
		<header className="relative z-30 flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
			<div className="flex items-center gap-6">
				<Link
					href={homePathForRole(role)}
					className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
				>
					GPON
				</Link>
				<nav
					className="hidden items-center gap-1 md:flex"
					aria-label="Navegación principal"
				>
					<NavLinks
						links={MAIN_LINKS}
						pathname={pathname}
						itemClassName="rounded-md px-2.5 py-1 text-xs"
					/>
					{isAdmin && (
						<>
							<span className="mx-2 h-4 w-px bg-border" aria-hidden="true" />
							<NavLinks
								links={ADMIN_LINKS}
								pathname={pathname}
								itemClassName="rounded-md px-2.5 py-1 text-xs"
							/>
						</>
					)}
				</nav>
			</div>

			<div className="hidden items-center gap-2 md:flex">
				<button
					type="button"
					onClick={openPalette}
					aria-label={`Abrir búsqueda (${paletteShortcut})`}
					className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<Search className="size-3" />
					<span>Buscar...</span>
					<kbd className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px]">
						{paletteShortcut}
					</kbd>
				</button>
				<span
					className="hidden max-w-40 truncate rounded-md border border-border-subtle px-2 py-1 text-xs text-fg-secondary lg:inline"
					title={email ?? undefined}
				>
					{ROLE_LABELS[role]}
				</span>
				<form action={signOut} onSubmit={guardSignOut}>
					<Button type="submit" variant="ghost" size="sm">
						Salir
					</Button>
				</form>
			</div>

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

			<AppDrawer
				open={open}
				onOpenChange={setOpen}
				title="Navegación"
				description="Acceso rápido a las secciones principales del sistema."
				direction="bottom"
				showClose={false}
				className="md:hidden"
				contentClassName="space-y-3"
			>
				<nav
					id="dashboard-mobile-nav"
					className="flex flex-col gap-1"
					aria-label="Navegación principal"
				>
					<NavLinks
						links={MAIN_LINKS}
						pathname={pathname}
						itemClassName="rounded-md px-3 py-2.5 text-sm"
					/>
					{isAdmin && (
						<>
							<p className="mt-3 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
								Administración
							</p>
							<NavLinks
								links={ADMIN_LINKS}
								pathname={pathname}
								itemClassName="rounded-md px-3 py-2.5 text-sm"
							/>
						</>
					)}
				</nav>
				<p className="border-t border-border px-3 pt-3 text-xs text-fg-muted">
					{email ? `${email} · ` : ""}
					{ROLE_LABELS[role]}
				</p>
				<form
					action={signOut}
					onSubmit={guardSignOut}
					className="border-t border-border pt-2"
				>
					<Button
						type="submit"
						variant="ghost"
						className="w-full justify-start"
					>
						Salir
					</Button>
				</form>
			</AppDrawer>
		</header>
	);
}
