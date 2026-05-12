"use client";

import { Keyboard } from "lucide-react";
import { useEffect, useState } from "react";
import { AppDrawer } from "@/components/ui/app-drawer";

interface ShortcutRow {
	keys: string[];
	label: string;
}

interface Section {
	title: string;
	rows: ShortcutRow[];
}

const SECTIONS: Section[] = [
	{
		title: "Navegación global",
		rows: [
			{ keys: ["g", "n"], label: "Ir a Redes" },
			{ keys: ["g", "m"], label: "Ir a Mapa" },
			{ keys: ["g", "s"], label: "Ir a Monitoreo" },
			{ keys: ["g", "d"], label: "Ir a Dashboard" },
			{ keys: ["⌘", "K"], label: "Abrir búsqueda de comandos" },
			{ keys: ["?"], label: "Mostrar / ocultar esta ayuda" },
		],
	},
	{
		title: "Editor de red",
		rows: [
			{ keys: ["v"], label: "Modo consulta" },
			{ keys: ["d"], label: "Modo diseño / captura" },
			{ keys: ["e"], label: "Modo edición de inventario" },
			{ keys: ["⌘", "Z"], label: "Deshacer" },
			{ keys: ["⌘", "⇧", "Z"], label: "Rehacer" },
			{ keys: ["Esc"], label: "Cerrar inspector / deseleccionar" },
		],
	},
	{
		title: "Paleta de comandos",
		rows: [
			{ keys: ["↑", "↓"], label: "Navegar entre resultados" },
			{ keys: ["↵"], label: "Ejecutar comando" },
			{ keys: ["Esc"], label: "Cerrar paleta" },
		],
	},
];

function Kbd({ children }: { children: string }) {
	return (
		<kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-muted px-1.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border">
			{children}
		</kbd>
	);
}

export function ShortcutsOverlay() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const onToggle = () => setOpen((v) => !v);
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("gpon:shortcuts", onToggle);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("gpon:shortcuts", onToggle);
			window.removeEventListener("keydown", onKey);
		};
	}, []);

	return (
		<AppDrawer
			open={open}
			onOpenChange={setOpen}
			title="Atajos de teclado"
			description="Navegación global, editor de red y paleta de comandos."
			size="lg"
			accent="#8bdff4"
			className="bg-[rgba(28,29,30,0.92)] text-[#d7d7d7] backdrop-blur-xl"
			contentClassName="space-y-5"
			footer={
				<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
					<Keyboard className="size-3.5" aria-hidden="true" />
					Presiona <Kbd>?</Kbd> para abrir o cerrar en cualquier momento.
				</div>
			}
		>
			<div className="grid gap-5 sm:grid-cols-2">
				{SECTIONS.map((section) => (
					<div key={section.title}>
						<p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							{section.title}
						</p>
						<div className="space-y-1">
							{section.rows.map((row) => (
								<div
									key={row.label}
									className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-white/[0.04]"
								>
									<span className="text-xs text-muted-foreground">
										{row.label}
									</span>
									<span className="flex shrink-0 items-center gap-1">
										{row.keys.map((k) => (
											<Kbd key={k}>{k}</Kbd>
										))}
									</span>
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</AppDrawer>
	);
}
