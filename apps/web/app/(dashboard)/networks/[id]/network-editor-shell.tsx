"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DiagramPanel } from "@/components/map/logical-diagram";
import { NetworkEditorMap } from "@/components/map/network-editor-map";
import { MAPBOX_TOKEN } from "@/lib/mapbox/config";
import {
	fetchNetworkEditorData,
	networkEditorKeys,
} from "@/lib/queries/network-editor";
import {
	type EditorMode,
	useNetworkEditorStore,
} from "@/lib/store/network-editor";
import type { UserRole } from "@/lib/types/gpon";
import { canWriteInfrastructure } from "@/lib/types/gpon";
import type { Network } from "@/lib/types/network";

const MODE_LABELS: Record<EditorMode, string> = {
	view: "Vista",
	design: "Crear",
	edit: "Editar",
};

interface Props {
	network: Network;
	networkId: string;
	userRole: UserRole | null;
}

export function NetworkEditorShell({ network, networkId, userRole }: Props) {
	const [diagramOpen, setDiagramOpen] = useState(false);

	const {
		mode,
		setMode,
		activeTool,
		setActiveTool,
		selection,
		select,
		deselect,
		statusMessage,
		setStatusMessage,
		updateElement,
		updateRoute,
		insertRouteVertex,
		moveRouteVertex,
		moveElement,
		isDirty,
		isSaving,
		validationErrors,
		hydrateNetwork,
		save,
		discard,
		getElementsArray,
		getRoutesArray,
		getRoutePointsArray,
	} = useNetworkEditorStore();

	const canEdit = canWriteInfrastructure(userRole);
	const networkQuery = useQuery({
		queryKey: networkEditorKeys.detail(networkId),
		queryFn: () => fetchNetworkEditorData(networkId),
	});

	useEffect(() => {
		if (networkQuery.data) {
			hydrateNetwork(networkId, networkQuery.data);
		}
	}, [networkId, networkQuery.data, hydrateNetwork]);

	useEffect(() => {
		if (mode === "design") setActiveTool("olt");
		else setActiveTool("select");
	}, [mode, setActiveTool]);

	const modes: EditorMode[] = canEdit ? ["view", "design", "edit"] : ["view"];

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Editor topbar */}
			<div className="flex h-11 shrink-0 items-center justify-between border-b border-[rgba(164,164,164,0.14)] bg-[#1e1f20] px-4 gap-4">
				{/* Left: breadcrumb + modes */}
				<div className="flex items-center gap-4">
					<Link
						href="/networks"
						className="text-xs text-[#777879] transition-colors hover:text-[#a4a4a4]"
					>
						← Redes
					</Link>
					<span className="text-[rgba(164,164,164,0.3)]">/</span>
					<span className="max-w-48 truncate text-xs font-medium text-[#e6e6e6]">
						{network.name}
					</span>

					{/* Mode pill selector */}
					<div className="flex rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)] p-0.5">
						{modes.map((m) => (
							<button
								key={m}
								type="button"
								aria-pressed={mode === m}
								onClick={() => setMode(m)}
								className="rounded px-3 py-1 text-[11px] font-medium transition-colors"
								style={{
									background:
										mode === m
											? m === "design"
												? "rgba(167,139,250,0.22)"
												: m === "edit"
													? "rgba(245,158,11,0.2)"
													: "rgba(56,189,248,0.16)"
											: "transparent",
									color:
										mode === m
											? m === "design"
												? "#c4b5fd"
												: m === "edit"
													? "#fbbf24"
													: "#bdeafe"
											: "#a4a4a4",
								}}
							>
								{MODE_LABELS[m]}
							</button>
						))}
					</div>
				</div>

				{/* Right: diagram toggle + dirty indicator + save */}
				<div className="flex items-center gap-3">
					{validationErrors.length > 0 && (
						<span
							className="max-w-52 truncate rounded-md border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] px-2 py-1 text-xs text-[#f59e0b]"
							title={statusMessage}
						>
							{validationErrors.length} advertencia
							{validationErrors.length > 1 ? "s" : ""}
						</span>
					)}
					<button
						type="button"
						onClick={() => setDiagramOpen(!diagramOpen)}
						className="text-xs text-[#777879] transition-colors hover:text-[#a4a4a4]"
					>
						{diagramOpen ? "↓" : "↑"} Diagrama
					</button>
					{isDirty && (
						<>
							<span className="text-xs text-[#777879]">
								Cambios sin guardar
							</span>
							<button
								type="button"
								onClick={discard}
								className="text-xs text-[#777879] transition-colors hover:text-[#a4a4a4]"
							>
								Descartar
							</button>
							<button
								type="button"
								onClick={save}
								disabled={isSaving}
								className="rounded-md border border-[rgba(52,211,153,0.35)] bg-[rgba(52,211,153,0.12)] px-3 py-1 text-xs font-medium text-[#34d399] transition-colors hover:bg-[rgba(52,211,153,0.2)] disabled:opacity-50"
							>
								{isSaving ? "Guardando…" : "Guardar"}
							</button>
						</>
					)}
					{!isDirty && <span className="text-xs text-[#5c5d5f]">Guardado</span>}
				</div>
			</div>

			{/* Map editor — full remaining height with min-h-0 */}
			<div className="relative min-h-0 flex-1 overflow-hidden">
				{networkQuery.isError && (
					<div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-md border border-[rgba(251,77,109,0.35)] bg-[rgba(34,35,36,0.94)] px-3 py-2 text-xs text-[#fb7185] shadow-xl">
						No se pudo cargar la red.
					</div>
				)}
				<NetworkEditorMap
					token={MAPBOX_TOKEN}
					equipment={getElementsArray()}
					connections={getRoutesArray()}
					routePoints={getRoutePointsArray()}
					mode={mode}
					activeTool={activeTool}
					selection={selection}
					onSelectionChange={(nextSelection) => {
						if (nextSelection) {
							select(nextSelection.id, nextSelection.kind);
						} else deselect();
					}}
					onStatusMessageChange={setStatusMessage}
					onUpdateElement={canEdit ? updateElement : undefined}
					onUpdateRoute={canEdit ? updateRoute : undefined}
					onInsertRouteVertex={canEdit ? insertRouteVertex : undefined}
					onMoveRouteVertex={canEdit ? moveRouteVertex : undefined}
					onMoveElement={canEdit ? moveElement : undefined}
				/>
			</div>

			{/* Logical diagram panel — collapsible */}
			<DiagramPanel
				isOpen={diagramOpen}
				onToggle={() => setDiagramOpen(!diagramOpen)}
			/>
		</div>
	);
}
