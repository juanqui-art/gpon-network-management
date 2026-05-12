"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

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
		<AnimatePresence>
			{open && (
				<>
					<motion.div
						key="shortcuts-backdrop"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						onClick={() => setOpen(false)}
						className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
					/>

					<motion.div
						key="shortcuts-panel"
						initial={{ opacity: 0, scale: 0.96, y: -8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: -8 }}
						transition={{ type: "spring", stiffness: 460, damping: 38 }}
						className="fixed left-1/2 top-[12%] z-50 w-full max-w-lg -translate-x-1/2"
					>
						<div className="overflow-hidden rounded-xl border border-white/10 bg-[rgba(28,29,30,0.88)] shadow-(--shadow-lg) backdrop-blur-xl">
							{/* Header */}
							<div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
								<h2 className="text-sm font-semibold text-foreground">
									Atajos de teclado
								</h2>
								<button
									type="button"
									onClick={() => setOpen(false)}
									aria-label="Cerrar"
									className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
								>
									<X className="size-4" />
								</button>
							</div>

							{/* Sections */}
							<div className="max-h-[60vh] overflow-y-auto p-4">
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
														<span className="flex items-center gap-1 shrink-0">
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
							</div>

							{/* Footer */}
							<div className="border-t border-white/[0.07] px-4 py-2">
								<p className="text-[10px] text-muted-foreground">
									Presiona <Kbd>?</Kbd> para abrir o cerrar en cualquier
									momento.
								</p>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
