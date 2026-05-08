"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPinned, NetworkIcon, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DiagramPanel } from "@/components/map/logical-diagram";
import { NetworkEditorMap } from "@/components/map/network-editor-map";
import { useNetworkEditorHistoryShortcuts } from "@/lib/hooks/use-network-editor-history-shortcuts";
import { MAPBOX_TOKEN } from "@/lib/mapbox/config";
import {
	fetchNetworkEditorData,
	networkEditorKeys,
} from "@/lib/queries/network-editor";
import { useNetworkEditorStore } from "@/lib/store/network-editor";
import type { UserRole } from "@/lib/types/gpon";
import { canWriteInfrastructure } from "@/lib/types/gpon";
import type { Network } from "@/lib/types/network";

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

	const { canRedo, canUndo } = useNetworkEditorHistoryShortcuts({
		enabled: canEdit,
		onHistoryChange: setStatusMessage,
	});

	useEffect(() => {
		if (networkQuery.data) {
			hydrateNetwork(networkId, networkQuery.data);
		}
	}, [networkId, networkQuery.data, hydrateNetwork]);

	useEffect(() => {
		setMode(canEdit ? "edit" : "view");
		setActiveTool("select");
	}, [canEdit, setActiveTool, setMode]);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Editor topbar */}
			<div className="flex h-11 shrink-0 items-center justify-between border-b border-[rgba(164,164,164,0.14)] bg-[#1e1f20] px-4 gap-4">
				{/* Left: breadcrumb + workspace identity */}
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
					<div className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.08)] px-2.5 py-1 text-[11px] font-medium text-[#fbbf24]">
						<MapPinned className="size-3.5" aria-hidden="true" />
						{canEdit ? "Edición de inventario" : "Consulta"}
					</div>
				</div>

				{/* Right: diagram toggle + dirty indicator + save */}
				<div className="flex items-center gap-3">
					{canEdit && (
						<Link
							href={`/networks/${networkId}/capture`}
							className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.1)] px-2.5 py-1 text-xs font-medium text-[#34d399] transition-colors hover:bg-[rgba(52,211,153,0.16)]"
						>
							<Plus className="size-3.5" aria-hidden="true" />
							Captura rápida
						</Link>
					)}
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
						className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(56,216,255,0.18)] bg-[rgba(56,216,255,0.06)] px-2.5 py-1 text-xs font-medium text-[#8bdff4] transition-colors hover:border-[rgba(56,216,255,0.32)] hover:bg-[rgba(56,216,255,0.1)]"
					>
						<NetworkIcon className="size-3.5" aria-hidden="true" />
						{diagramOpen ? "Ocultar" : "Abrir"} unifilar
					</button>
					{isDirty && (
						<>
							<span className="text-xs text-[#777879]">
								Cambios sin guardar · Ctrl+Z revierte
							</span>
							<span
								className="rounded-md border border-[rgba(164,164,164,0.14)] bg-[rgba(164,164,164,0.05)] px-2 py-1 text-[11px] text-[#8f969e]"
								title={
									canUndo
										? "Ctrl+Z para deshacer. Ctrl+Shift+Z o Ctrl+Y para rehacer."
										: "No hay cambios reversibles todavía."
								}
							>
								{canUndo ? "Deshacer disponible" : "Sin historial"}
								{canRedo ? " · Rehacer" : ""}
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
