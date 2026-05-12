"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppDrawer } from "@/components/ui/app-drawer";
import type { UserRole } from "@/lib/types/gpon";
import {
	type NetworkSummary,
	type NetworkTopology,
	TOPOLOGY_DESCRIPTIONS,
	TOPOLOGY_LABELS,
} from "@/lib/types/network";

const TOPOLOGIES: NetworkTopology[] = ["blank", "star", "tree", "cascade"];

const TOPOLOGY_ICON: Record<NetworkTopology, string> = {
	blank: "○",
	star: "✦",
	tree: "⑂",
	cascade: "≡",
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
			setArchiveTarget(null);
			setArchiveConfirmation("");
			setArchiveReason("");
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error al archivar la red");
		} finally {
			setArchiving(false);
		}
	}

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto max-w-4xl px-6 py-10">
				{/* Header */}
				<div className="mb-8 flex items-center justify-between">
					<div>
						<h1 className="text-balance text-xl font-semibold text-foreground">
							Redes GPON
						</h1>
						<p className="mt-1 text-sm text-[#777879]">
							{networks.length} {networks.length === 1 ? "red" : "redes"}{" "}
							configuradas
						</p>
					</div>
					{networks.length > 0 && (
						<button
							type="button"
							onClick={() => setShowNew(true)}
							className="rounded-lg bg-[var(--accent-brand)] px-4 py-2 text-sm font-medium text-white shadow-[0_1px_6px_rgba(14,165,233,0.35)] transition-all hover:bg-[var(--accent-brand-hover)] hover:shadow-[0_1px_10px_rgba(14,165,233,0.45)]"
						>
							+ Nueva red
						</button>
					)}
				</div>
				{networks.length === 0 && (
					<div className="mb-8 rounded-xl border border-dashed border-[rgba(164,164,164,0.16)] px-6 py-16 text-center">
						<p className="text-sm text-[#777879]">
							No hay redes todavía. Crea la primera para empezar.
						</p>
						<button
							type="button"
							onClick={() => setShowNew(true)}
							className="mt-5 rounded-lg bg-[var(--accent-brand)] px-4 py-2 text-sm font-medium text-white shadow-[0_1px_6px_rgba(14,165,233,0.35)] transition-all hover:bg-[var(--accent-brand-hover)] hover:shadow-[0_1px_10px_rgba(14,165,233,0.45)]"
						>
							+ Crear primera red
						</button>
					</div>
				)}

				{/* Networks list */}
				{networks.length > 0 && (
					<div className="space-y-2">
						{networks.map((net) => (
							<div
								key={net.id}
								className="flex w-full items-center justify-between rounded-xl border border-[rgba(164,164,164,0.12)] bg-[rgba(34,35,36,0.7)] px-5 py-4 text-left transition-colors hover:border-[rgba(164,164,164,0.24)] hover:bg-[rgba(34,35,36,0.9)]"
							>
								<button
									type="button"
									onClick={() => router.push(`/networks/${net.id}`)}
									className="flex min-w-0 flex-1 items-center gap-4 text-left"
								>
									<span className="text-xl text-[#777879]">
										{TOPOLOGY_ICON[net.topology as NetworkTopology] ?? "○"}
									</span>
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold text-[#e6e6e6]">
											{net.name}
										</p>
										{net.description && (
											<p className="mt-0.5 truncate text-xs text-[#777879]">
												{net.description}
											</p>
										)}
									</div>
								</button>
								<div className="flex items-center gap-6 text-right">
									<div>
										<p className="font-mono text-sm text-[#e6e6e6]">
											{net.element_count}
										</p>
										<p className="text-[10px] text-[#777879]">elementos</p>
									</div>
									<div>
										<p className="font-mono text-sm text-[#e6e6e6]">
											{net.route_count}
										</p>
										<p className="text-[10px] text-[#777879]">rutas</p>
									</div>
									{canArchive && (
										<button
											type="button"
											onClick={() => {
												setArchiveTarget(net);
												setArchiveConfirmation("");
												setArchiveReason("");
												setError(null);
											}}
											className="rounded-md border border-[rgba(251,77,109,0.25)] px-2.5 py-1 text-xs font-medium text-[#fb7185] transition-colors hover:bg-[rgba(251,77,109,0.1)]"
										>
											Archivar
										</button>
									)}
									<button
										type="button"
										onClick={() => router.push(`/networks/${net.id}`)}
										className="text-[#5c5d5f] transition-colors hover:text-[#a4a4a4]"
										aria-label={`Abrir ${net.name}`}
									>
										→
									</button>
								</div>
							</div>
						))}
					</div>
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
						<div className="flex items-center justify-end gap-3">
							<button
								type="button"
								onClick={() => setShowNew(false)}
								className="text-sm text-[#777879] transition-colors hover:text-[#a4a4a4]"
							>
								Cancelar
							</button>
							<button
								type="submit"
								form="create-network-form"
								disabled={creating || !name.trim()}
								className="rounded-lg bg-[rgba(56,189,248,0.18)] px-5 py-2 text-sm font-medium text-[#bdeafe] transition-colors hover:bg-[rgba(56,189,248,0.28)] disabled:opacity-50"
							>
								{creating ? "Creando..." : "Crear red"}
							</button>
						</div>
					}
				>
					<form
						id="create-network-form"
						onSubmit={handleCreate}
						className="space-y-5"
					>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1.5 block text-xs text-[#777879]">
									Nombre *
								</span>
								<input
									type="text"
									required
									placeholder="Ej. Quito Norte — Sector A"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[rgba(27,28,29,0.8)] px-3 py-2 text-sm text-[#e6e6e6] outline-none transition-colors placeholder:text-[#5c5d5f] focus:border-[rgba(56,189,248,0.45)]"
								/>
							</label>
							<label className="block">
								<span className="mb-1.5 block text-xs text-[#777879]">
									Descripción
								</span>
								<input
									type="text"
									placeholder="Zona de cobertura, notas..."
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[rgba(27,28,29,0.8)] px-3 py-2 text-sm text-[#e6e6e6] outline-none transition-colors placeholder:text-[#5c5d5f] focus:border-[rgba(56,189,248,0.45)]"
								/>
							</label>
						</div>

						<div>
							<span className="mb-2 block text-xs text-[#777879]">
								Plantilla de topología
							</span>
							<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
								{TOPOLOGIES.map((t) => (
									<button
										key={t}
										type="button"
										onClick={() => setTopology(t)}
										className="rounded-lg border p-3 text-left transition-colors"
										style={{
											borderColor:
												topology === t
													? "rgba(56,189,248,0.45)"
													: "rgba(164,164,164,0.14)",
											background:
												topology === t
													? "rgba(56,189,248,0.1)"
													: "rgba(164,164,164,0.04)",
										}}
									>
										<p className="mb-1 text-base">{TOPOLOGY_ICON[t]}</p>
										<p
											className="text-xs font-semibold"
											style={{
												color: topology === t ? "#bdeafe" : "#d7d7d7",
											}}
										>
											{TOPOLOGY_LABELS[t]}
										</p>
										<p className="mt-0.5 text-[10px] text-[#777879]">
											{TOPOLOGY_DESCRIPTIONS[t]}
										</p>
									</button>
								))}
							</div>
						</div>

						{error && (
							<p className="rounded-md border border-[rgba(251,77,109,0.28)] bg-[rgba(251,77,109,0.08)] px-3 py-2 text-xs text-[#fb7185]">
								{error}
							</p>
						)}
					</form>
				</AppDrawer>
				<AppDrawer
					open={Boolean(archiveTarget)}
					onOpenChange={(open) => {
						if (open) return;
						setArchiveTarget(null);
						setArchiveConfirmation("");
						setArchiveReason("");
					}}
					title="Archivar red crítica"
					description="Esta acción ocultará la red del listado principal y deshabilitará su uso operativo normal. No se borrarán elementos ni rutas."
					className="border-[rgba(251,77,109,0.28)]"
					footer={
						archiveTarget && (
							<div className="flex items-center justify-end gap-3">
								<button
									type="button"
									onClick={() => {
										setArchiveTarget(null);
										setArchiveConfirmation("");
										setArchiveReason("");
									}}
									className="text-sm text-[#777879] transition-colors hover:text-[#a4a4a4]"
								>
									Cancelar
								</button>
								<button
									type="submit"
									form="archive-network-form"
									disabled={
										archiving || archiveConfirmation !== archiveTarget.name
									}
									className="rounded-lg border border-[rgba(251,77,109,0.35)] bg-[rgba(251,77,109,0.12)] px-4 py-2 text-sm font-medium text-[#fb7185] transition-colors hover:bg-[rgba(251,77,109,0.2)] disabled:opacity-50"
								>
									{archiving ? "Archivando..." : "Archivar red"}
								</button>
							</div>
						)
					}
				>
					{archiveTarget && (
						<>
							<div className="rounded-lg border border-[rgba(164,164,164,0.12)] bg-[rgba(27,28,29,0.65)] p-3 text-xs text-[#a4a4a4]">
								<p>
									<span className="text-[#777879]">Red:</span>{" "}
									<span className="font-semibold text-[#e6e6e6]">
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
								<label className="block">
									<span className="mb-1.5 block text-xs text-[#777879]">
										Escribe el nombre exacto para confirmar
									</span>
									<input
										type="text"
										value={archiveConfirmation}
										onChange={(event) =>
											setArchiveConfirmation(event.target.value)
										}
										className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[rgba(27,28,29,0.8)] px-3 py-2 text-sm text-[#e6e6e6] outline-none transition-colors focus:border-[rgba(251,77,109,0.45)]"
									/>
								</label>
								<label className="block">
									<span className="mb-1.5 block text-xs text-[#777879]">
										Motivo opcional
									</span>
									<input
										type="text"
										value={archiveReason}
										onChange={(event) => setArchiveReason(event.target.value)}
										placeholder="Duplicada, prueba, migración..."
										className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[rgba(27,28,29,0.8)] px-3 py-2 text-sm text-[#e6e6e6] outline-none transition-colors placeholder:text-[#5c5d5f] focus:border-[rgba(251,77,109,0.45)]"
									/>
								</label>
							</form>
						</>
					)}
				</AppDrawer>
			</div>
		</div>
	);
}
