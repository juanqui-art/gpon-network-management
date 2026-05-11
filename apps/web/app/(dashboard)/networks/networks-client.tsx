"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

export function NetworksClient({ networks }: { networks: NetworkSummary[] }) {
	const router = useRouter();
	const [showNew, setShowNew] = useState(networks.length === 0);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [topology, setTopology] = useState<NetworkTopology>("blank");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
			router.push(`/networks/${data}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error al crear la red");
			setCreating(false);
		}
	}

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			{/* Header */}
			<div className="mb-8 flex items-center justify-between">
				<div>
					<h1 className="text-xl font-semibold text-[#e6e6e6]">Redes GPON</h1>
					<p className="mt-1 text-sm text-[#777879]">
						{networks.length} {networks.length === 1 ? "red" : "redes"}{" "}
						configuradas
					</p>
				</div>
				{networks.length > 0 && (
					<button
						type="button"
						onClick={() => setShowNew((v) => !v)}
						className="rounded-lg border border-[rgba(56,189,248,0.35)] bg-[rgba(56,189,248,0.1)] px-4 py-2 text-sm font-medium text-[#bdeafe] transition-colors hover:bg-[rgba(56,189,248,0.18)]"
					>
						+ Nueva red
					</button>
				)}
			</div>

			{/* New network form */}
			{showNew && (
				<div className="mb-8 rounded-xl border border-[rgba(56,189,248,0.2)] bg-[rgba(34,35,36,0.9)] p-6 shadow-2xl">
					<h2 className="mb-5 text-sm font-semibold text-[#e6e6e6]">
						Crear nueva red
					</h2>
					<form onSubmit={handleCreate} className="space-y-5">
						{/* Name + description */}
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

						{/* Topology selector */}
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

						<div className="flex items-center gap-3">
							<button
								type="submit"
								disabled={creating || !name.trim()}
								className="rounded-lg bg-[rgba(56,189,248,0.18)] px-5 py-2 text-sm font-medium text-[#bdeafe] transition-colors hover:bg-[rgba(56,189,248,0.28)] disabled:opacity-50"
							>
								{creating ? "Creando..." : "Crear red"}
							</button>
							{networks.length > 0 && (
								<button
									type="button"
									onClick={() => setShowNew(false)}
									className="text-sm text-[#777879] hover:text-[#a4a4a4]"
								>
									Cancelar
								</button>
							)}
						</div>
					</form>
				</div>
			)}

			{/* Networks list */}
			{networks.length > 0 && (
				<div className="space-y-2">
					{networks.map((net) => (
						<button
							key={net.id}
							type="button"
							onClick={() => router.push(`/networks/${net.id}`)}
							className="flex w-full items-center justify-between rounded-xl border border-[rgba(164,164,164,0.12)] bg-[rgba(34,35,36,0.7)] px-5 py-4 text-left transition-colors hover:border-[rgba(164,164,164,0.24)] hover:bg-[rgba(34,35,36,0.9)]"
						>
							<div className="flex items-center gap-4">
								<span className="text-xl text-[#777879]">
									{TOPOLOGY_ICON[net.topology as NetworkTopology] ?? "○"}
								</span>
								<div>
									<p className="text-sm font-semibold text-[#e6e6e6]">
										{net.name}
									</p>
									{net.description && (
										<p className="mt-0.5 text-xs text-[#777879]">
											{net.description}
										</p>
									)}
								</div>
							</div>
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
								<span className="text-[#5c5d5f]">→</span>
							</div>
						</button>
					))}
				</div>
			)}

			{networks.length === 0 && !showNew && (
				<div className="rounded-xl border border-dashed border-[rgba(164,164,164,0.16)] py-16 text-center">
					<p className="text-sm text-[#777879]">
						No hay redes todavía. Crea la primera.
					</p>
				</div>
			)}
		</div>
	);
}
