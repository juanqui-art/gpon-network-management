"use client";

import {
	Archive,
	ArrowRight,
	Circle,
	GitFork,
	Layers3,
	type LucideIcon,
	Network as NetworkIcon,
	Plus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppDrawer } from "@/components/ui/app-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/feedback/toast";
import type { UserRole } from "@/lib/types/gpon";
import {
	type NetworkSummary,
	type NetworkTopology,
	TOPOLOGY_DESCRIPTIONS,
	TOPOLOGY_LABELS,
} from "@/lib/types/network";

const TOPOLOGIES: NetworkTopology[] = ["blank", "star", "tree", "cascade"];

const TOPOLOGY_ICON: Record<NetworkTopology, LucideIcon> = {
	blank: Circle,
	star: NetworkIcon,
	tree: GitFork,
	cascade: Layers3,
};

export function NetworksClient({
	networks,
	userRole,
}: {
	networks: NetworkSummary[];
	userRole: UserRole | null;
}) {
	const router = useRouter();
	const [showNew, setShowNew] = useState(networks.length === 0);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [topology, setTopology] = useState<NetworkTopology>("blank");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [archiveTarget, setArchiveTarget] = useState<NetworkSummary | null>(
		null,
	);
	const [archiveConfirmation, setArchiveConfirmation] = useState("");
	const [archiveReason, setArchiveReason] = useState("");
	const [archiving, setArchiving] = useState(false);
	const canArchive = userRole === "admin";

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		setCreating(true);
		setError(null);

		try {
			const { createClient } = await import("@/lib/supabase/client");
			const supabase = createClient();
			const { data, error: rpcError } = await supabase.rpc("create_network", {
				p_name: name.trim(),
				p_description: description.trim() || null,
				p_topology: topology,
			});
			if (rpcError) throw rpcError;
			router.push(`/networks/${data}/capture`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error al crear la red");
			setCreating(false);
		}
	}

	async function handleArchive(e: React.FormEvent) {
		e.preventDefault();
		if (!archiveTarget || archiveConfirmation !== archiveTarget.name) return;
		setArchiving(true);
		setError(null);

		try {
			const { createClient } = await import("@/lib/supabase/client");
			const supabase = createClient();
			const { error: rpcError } = await supabase.rpc("archive_network", {
				p_network_id: archiveTarget.id,
				p_confirm_name: archiveConfirmation,
				p_reason: archiveReason.trim() || null,
			});
			if (rpcError) throw rpcError;
			toast({
				tone: "success",
				title: "Red archivada",
				description: archiveTarget.name,
			});
			closeArchive();
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error al archivar la red");
		} finally {
			setArchiving(false);
		}
	}

	function closeArchive() {
		setArchiveTarget(null);
		setArchiveConfirmation("");
		setArchiveReason("");
	}

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
				<div className="mb-8 flex items-center justify-between gap-4">
					<div>
						<h1 className="text-balance text-xl font-semibold text-fg">
							Redes GPON
						</h1>
						<p className="mt-1 text-sm text-fg-muted">
							{networks.length === 1
								? "1 red configurada"
								: `${networks.length} redes configuradas`}
						</p>
					</div>
					{networks.length > 0 && (
						<Button variant="accent" size="lg" onClick={() => setShowNew(true)}>
							<Plus aria-hidden="true" />
							Nueva red
						</Button>
					)}
				</div>

				{networks.length === 0 && (
					<div className="mb-8 rounded-xl border border-dashed border-border px-6 py-16 text-center">
						<p className="text-sm text-fg-muted">
							No hay redes todavía. Crea la primera para empezar.
						</p>
						<Button
							variant="accent"
							size="lg"
							className="mt-5"
							onClick={() => setShowNew(true)}
						>
							<Plus aria-hidden="true" />
							Crear primera red
						</Button>
					</div>
				)}

				{networks.length > 0 && (
					<ul className="space-y-2">
						{networks.map((net) => {
							const Icon =
								TOPOLOGY_ICON[net.topology as NetworkTopology] ?? Circle;
							return (
								<li
									key={net.id}
									className="group relative flex items-center gap-4 rounded-xl border border-border-subtle bg-surface-panel/70 px-4 py-4 transition-colors hover:border-border hover:bg-surface-panel sm:px-5"
								>
									<Icon
										className="size-5 shrink-0 text-fg-muted"
										aria-hidden="true"
									/>
									<div className="min-w-0 flex-1">
										{/* Whole row is the link (stretched ::after), so cmd/ctrl-click
										    and "open in new tab" work. */}
										<Link
											href={`/networks/${net.id}`}
											className="block truncate text-sm font-semibold text-fg outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-info/50"
										>
											{net.name}
										</Link>
										<p className="mt-0.5 truncate text-xs text-fg-muted">
											{TOPOLOGY_LABELS[net.topology as NetworkTopology] ??
												"Topología sin definir"}
											{net.description ? ` · ${net.description}` : ""}
										</p>
									</div>
									<dl className="hidden items-center gap-6 text-right sm:flex">
										<div>
											<dd className="font-mono text-sm text-fg">
												{net.element_count}
											</dd>
											<dt className="text-[11px] text-fg-muted">elementos</dt>
										</div>
										<div>
											<dd className="font-mono text-sm text-fg">
												{net.route_count}
											</dd>
											<dt className="text-[11px] text-fg-muted">rutas</dt>
										</div>
									</dl>
									{canArchive && (
										<Button
											variant="ghost"
											size="icon"
											aria-label={`Archivar ${net.name}`}
											title="Archivar red"
											className="relative z-10 text-fg-muted"
											onClick={() => {
												setArchiveTarget(net);
												setArchiveConfirmation("");
												setArchiveReason("");
												setError(null);
											}}
										>
											<Archive aria-hidden="true" />
										</Button>
									)}
									<ArrowRight
										className="size-4 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-fg-secondary"
										aria-hidden="true"
									/>
								</li>
							);
						})}
					</ul>
				)}

				<AppDrawer
					open={showNew}
					onOpenChange={(open) => {
						setShowNew(open);
						if (!open) {
							setName("");
							setDescription("");
							setTopology("blank");
							setError(null);
						}
					}}
					title="Crear nueva red"
					description="Define el nombre, una descripción opcional y la plantilla de topología para arrancar la captura."
					size="lg"
					footer={
						<div className="flex items-center justify-end gap-2">
							<Button variant="ghost" onClick={() => setShowNew(false)}>
								Cancelar
							</Button>
							<Button
								type="submit"
								form="create-network-form"
								variant="accent"
								disabled={creating || !name.trim()}
							>
								{creating ? "Creando…" : "Crear red"}
							</Button>
						</div>
					}
				>
					<form
						id="create-network-form"
						onSubmit={handleCreate}
						className="space-y-5"
					>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label htmlFor="network-name" className="text-xs text-fg-muted">
									Nombre <span aria-hidden="true">*</span>
								</Label>
								<Input
									id="network-name"
									required
									placeholder="Ej. Cuenca Centro — Sector El Ejido"
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label
									htmlFor="network-description"
									className="text-xs text-fg-muted"
								>
									Descripción
								</Label>
								<Input
									id="network-description"
									placeholder="Zona de cobertura, notas…"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
								/>
							</div>
						</div>

						<fieldset>
							<legend className="mb-2 block text-xs text-fg-muted">
								Plantilla de topología
							</legend>
							<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
								{TOPOLOGIES.map((t) => {
									const Icon = TOPOLOGY_ICON[t];
									const selected = topology === t;
									return (
										<label
											key={t}
											className={`cursor-pointer rounded-lg border p-3 text-left transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info/50 ${
												selected
													? "border-info/45 bg-info/10"
													: "border-border-subtle bg-tint/4 hover:border-border"
											}`}
										>
											<input
												type="radio"
												name="topology"
												value={t}
												checked={selected}
												onChange={() => setTopology(t)}
												className="sr-only"
											/>
											<Icon
												className={`mb-1.5 size-4 ${selected ? "text-info-fg" : "text-fg-muted"}`}
												aria-hidden="true"
											/>
											<span
												className={`block text-xs font-semibold ${selected ? "text-info-strong" : "text-fg-soft"}`}
											>
												{TOPOLOGY_LABELS[t]}
											</span>
											<span className="mt-0.5 block text-[11px] text-fg-muted">
												{TOPOLOGY_DESCRIPTIONS[t]}
											</span>
										</label>
									);
								})}
							</div>
						</fieldset>

						{error && (
							<p
								role="alert"
								className="rounded-md border border-danger/30 bg-danger/8 px-3 py-2 text-xs text-danger-fg"
							>
								{error}
							</p>
						)}
					</form>
				</AppDrawer>

				<AppDrawer
					open={Boolean(archiveTarget)}
					onOpenChange={(open) => {
						if (!open) closeArchive();
					}}
					title="Archivar red"
					description="La red se ocultará del listado principal y dejará de usarse en la operación normal. No se borran elementos ni rutas."
					className="border-danger/30"
					footer={
						archiveTarget && (
							<div className="flex items-center justify-end gap-2">
								<Button variant="ghost" onClick={closeArchive}>
									Cancelar
								</Button>
								<Button
									type="submit"
									form="archive-network-form"
									variant="destructive"
									disabled={
										archiving || archiveConfirmation !== archiveTarget.name
									}
								>
									{archiving ? "Archivando…" : "Archivar red"}
								</Button>
							</div>
						)
					}
				>
					{archiveTarget && (
						<>
							<div className="rounded-lg border border-border-subtle bg-surface-sunken p-3 text-xs text-fg-secondary">
								<p>
									<span className="text-fg-muted">Red:</span>{" "}
									<span className="font-semibold text-fg">
										{archiveTarget.name}
									</span>
								</p>
								<p className="mt-1">
									{archiveTarget.element_count} elementos ·{" "}
									{archiveTarget.route_count} rutas
								</p>
							</div>
							<form
								id="archive-network-form"
								onSubmit={handleArchive}
								className="mt-5 space-y-4"
							>
								<div className="space-y-1.5">
									<Label
										htmlFor="archive-confirm"
										className="text-xs text-fg-muted"
									>
										Escribe el nombre exacto para confirmar
									</Label>
									<Input
										id="archive-confirm"
										autoComplete="off"
										value={archiveConfirmation}
										onChange={(event) =>
											setArchiveConfirmation(event.target.value)
										}
										className="focus-visible:border-danger/45 focus-visible:ring-danger/20"
									/>
								</div>
								<div className="space-y-1.5">
									<Label
										htmlFor="archive-reason"
										className="text-xs text-fg-muted"
									>
										Motivo (opcional)
									</Label>
									<Input
										id="archive-reason"
										value={archiveReason}
										onChange={(event) => setArchiveReason(event.target.value)}
										placeholder="Duplicada, prueba, migración…"
									/>
								</div>
								{error && (
									<p
										role="alert"
										className="rounded-md border border-danger/30 bg-danger/8 px-3 py-2 text-xs text-danger-fg"
									>
										{error}
									</p>
								)}
							</form>
						</>
					)}
				</AppDrawer>
			</div>
		</div>
	);
}
