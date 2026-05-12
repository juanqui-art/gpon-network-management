"use client";

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "cmdk";
import {
	BarChart3,
	FileText,
	MapPin,
	Network,
	Radio,
	Settings,
	Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const NAV_COMMANDS = [
	{ label: "Dashboard", href: "/dashboard", icon: BarChart3, group: "Navegar" },
	{ label: "Redes GPON", href: "/networks", icon: Network, group: "Navegar" },
	{ label: "Mapa de red", href: "/map", icon: MapPin, group: "Navegar" },
	{
		label: "Monitoreo OLTs",
		href: "/monitoring",
		icon: Radio,
		group: "Navegar",
	},
] as const;

const ADMIN_COMMANDS = [
	{ label: "Usuarios y roles", href: "/admin/users", icon: Users },
	{ label: "Auditoría", href: "/admin/audit", icon: FileText },
	{ label: "Configuración", href: "/admin/settings", icon: Settings },
] as const;

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const router = useRouter();

	const toggle = useCallback(() => setOpen((v) => !v), []);
	const close = useCallback(() => setOpen(false), []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				toggle();
			}
			if (e.key === "Escape") close();
		};
		const onOpen = () => setOpen(true);
		window.addEventListener("keydown", onKey);
		window.addEventListener("gpon:palette", onOpen);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("gpon:palette", onOpen);
		};
	}, [toggle, close]);

	function run(href: string) {
		router.push(href);
		close();
	}

	return (
		<AnimatePresence>
			{open && (
				<>
					{/* Backdrop */}
					<motion.div
						key="backdrop"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						onClick={close}
						className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
					/>

					{/* Palette */}
					<motion.div
						key="palette"
						initial={{ opacity: 0, scale: 0.96, y: -8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: -8 }}
						transition={{ type: "spring", stiffness: 460, damping: 38 }}
						className="fixed left-1/2 top-[18%] z-50 w-full max-w-md -translate-x-1/2"
					>
						<Command
							className="overflow-hidden rounded-xl border border-white/10 bg-[rgba(28,29,30,0.88)] shadow-(--shadow-lg) backdrop-blur-xl"
							loop
						>
							<div className="flex items-center border-b border-white/[0.07] px-3">
								<CommandInput
									placeholder="Buscar acciones, rutas..."
									className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
								/>
							</div>

							<CommandList className="max-h-72 overflow-y-auto p-1.5">
								<CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
									Sin resultados.
								</CommandEmpty>

								<CommandGroup
									heading="Navegar"
									className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
								>
									{NAV_COMMANDS.map(({ label, href, icon: Icon }) => (
										<CommandItem
											key={href}
											value={label}
											onSelect={() => run(href)}
											className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground outline-none data-[selected=true]:bg-white/[0.07] data-[selected=true]:text-foreground"
										>
											<Icon className="size-4 shrink-0 text-muted-foreground" />
											{label}
										</CommandItem>
									))}
								</CommandGroup>

								<CommandSeparator className="my-1 h-px bg-white/[0.06]" />

								<CommandGroup
									heading="Admin"
									className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
								>
									{ADMIN_COMMANDS.map(({ label, href, icon: Icon }) => (
										<CommandItem
											key={href}
											value={label}
											onSelect={() => run(href)}
											className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground outline-none data-[selected=true]:bg-white/[0.07] data-[selected=true]:text-foreground"
										>
											<Icon className="size-4 shrink-0 text-muted-foreground" />
											{label}
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>

							<div className="flex items-center gap-4 border-t border-white/[0.07] px-3 py-2">
								<span className="flex items-center gap-1 text-[10px] text-muted-foreground">
									<kbd className="rounded bg-muted px-1 font-mono">↑↓</kbd>
									navegar
								</span>
								<span className="flex items-center gap-1 text-[10px] text-muted-foreground">
									<kbd className="rounded bg-muted px-1 font-mono">↵</kbd>
									abrir
								</span>
								<span className="flex items-center gap-1 text-[10px] text-muted-foreground">
									<kbd className="rounded bg-muted px-1 font-mono">Esc</kbd>
									cerrar
								</span>
							</div>
						</Command>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
