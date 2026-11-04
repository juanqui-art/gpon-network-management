"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeft,
	Eye,
	NetworkIcon,
	Pencil,
	Plus,
	Redo2,
	Undo2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DiagramPanel } from "@/components/map/logical-diagram";
import { NetworkEditorMap } from "@/components/map/network-editor-map";
import { NetworkLoadState } from "@/components/map/network-load-state";
import { confirmAction } from "@/lib/feedback/confirm";
import { toast } from "@/lib/feedback/toast";
import { useEditorShortcuts } from "@/lib/hooks/use-editor-shortcuts";
import { useNetworkEditorHistoryShortcuts } from "@/lib/hooks/use-network-editor-history-shortcuts";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";
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
		resetEditor,
		getElementsArray,
		getRoutesArray,
		getRoutePointsArray,
	} = useNetworkEditorStore();

	const canEdit = canWriteInfrastructure(userRole);
	const queryClient = useQueryClient();
	const networkQuery = useQuery({
		queryKey: networkEditorKeys.detail(networkId),
		queryFn: () => fetchNetworkEditorData(networkId),
	});

	/** Save, refresh the cached snapshot and report the outcome. */
	const saveChanges = useCallback(async (): Promise<boolean> => {
		const ok = await save();
		const message = useNetworkEditorStore.getState().statusMessage;
		if (ok) {
			void queryClient.invalidateQueries({
				queryKey: networkEditorKeys.detail(networkId),
			});
			toast({ tone: "success", title: "Cambios guardados" });
		} else {
			toast({
				tone: "error",
				title: "No se pudieron guardar los cambios",
				description: message,
			});
		}
		return ok;
	}, [networkId, queryClient, save]);

	const handleDiscard = async () => {
		const confirmed = await confirmAction({
			title: "¿Descartar los cambios?",
			description:
				"Se perderán todas las modificaciones locales desde el último guardado. Esta acción no se puede deshacer.",
			confirmLabel: "Descartar cambios",
			cancelLabel: "Conservar",
			tone: "danger",
		});
		if (!confirmed) return;
		discard();
		toast({ tone: "info", title: "Cambios descartados" });
	};

	const changeMode = (next: EditorMode) => {
		setMode(next);
		setActiveTool("select");
		deselect();
	};

	useUnsavedChangesGuard({
		enabled: isDirty,
		allowPathPrefix: `/networks/${networkId}`,
		message:
			"Hay cambios en elementos, rutas o puntos de esta red que aún no se guardaron en la base de datos.",
		onSave: saveChanges,
		onLeave: resetEditor,
	});

	useEditorShortcuts({ canEdit });

	const { canRedo, canUndo } = useNetworkEditorHistoryShortcuts({
		enabled: canEdit,
		onHistoryChange: setStatusMessage,
	});

	useEffect(() => {
		if (networkQuery.data) {
			hydrateNetwork(networkId, networkQuery.data);
		}
	}, [networkId, networkQuery.data, hydrateNetwork]);

	// Always open in read mode: editing (dragging elements / vertices) is an
	// explicit choice, so a consultation never mutates geometry by accident.
	useEffect(() => {
		setMode("view");
		setActiveTool("select");
	}, [setActiveTool, setMode]);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Editor topbar */}
			<div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[rgba(164,164,164,0.14)] bg-[#1e1f20] px-3 sm:gap-4 sm:px-4">
				{/* Left: breadcrumb + workspace identity */}
				<div className="flex min-w-0 items-center gap-2 sm:gap-4">
					<Link
						href="/networks"
						aria-label="Volver a Redes"
						className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[#e6e6e6]"
					>
						<ArrowLeft className="size-4" aria-hidden="true" />
						<span className="hidden sm:inline">Redes</span>
					</Link>
					<span
						className="hidden text-[rgba(164,164,164,0.3)] md:inline"
						aria-hidden="true"
					>
						/
					</span>
					<span className="hidden max-w-48 truncate text-xs font-medium text-[#e6e6e6] md:inline">
						{network.name}
					</span>
					{canEdit ? (
						<fieldset className="inline-flex items-center rounded-md border border-[rgba(164,164,164,0.16)] bg-[rgba(164,164,164,0.04)] p-0.5">
							<legend className="sr-only">Modo del editor</legend>
							{(
								[
									{ value: "view", label: "Consulta", icon: Eye, key: "V" },
									{ value: "edit", label: "Edición", icon: Pencil, key: "E" },
								] as const
							).map((option) => {
								const active =
									option.value === "view" ? mode !== "edit" : mode === "edit";
								const Icon = option.icon;
								return (
									<button
										key={option.value}
										type="button"
										aria-pressed={active}
										aria-label={option.label}
										title={`${option.label} (atajo: ${option.key})`}
										onClick={() => changeMode(option.value)}
										className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors ${
											active
												? option.value === "edit"
													? "bg-[rgba(56,189,248,0.16)] text-[#bdeafe]"
													: "bg-[rgba(164,164,164,0.14)] text-[#e6e6e6]"
												: "text-[var(--text-secondary)] hover:text-[#e6e6e6]"
										}`}
									>
										<Icon className="size-3.5" aria-hidden="true" />
										<span className="hidden sm:inline">{option.label}</span>
									</button>
								);
							})}
						</fieldset>
					) : (
						<div className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(164,164,164,0.16)] bg-[rgba(164,164,164,0.06)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
							<Eye className="size-3.5" aria-hidden="true" />
							Solo lectura
						</div>
					)}
				</div>

				{/* Right: diagram toggle + dirty indicator + save */}
				<div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
					{canEdit && (
						<Link
							href={`/networks/${networkId}/capture`}
							aria-label="Captura rápida"
							title="Captura rápida"
							className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.1)] px-2.5 text-xs font-medium text-[#34d399] transition-colors hover:bg-[rgba(52,211,153,0.16)]"
						>
							<Plus className="size-3.5" aria-hidden="true" />
							<span className="hidden lg:inline">Captura rápida</span>
						</Link>
					)}
					{validationErrors.length > 0 && (
						<span
							className="hidden max-w-52 truncate rounded-md border border-[rgba(245,158,11,0.22)] md:inline-block bg-[rgba(245,158,11,0.08)] px-2 py-1 text-xs text-[#f59e0b]"
							title={statusMessage}
						>
							{validationErrors.length} advertencia
							{validationErrors.length > 1 ? "s" : ""}
						</span>
					)}
					<button
						type="button"
						onClick={() => setDiagramOpen(!diagramOpen)}
						aria-label={diagramOpen ? "Ocultar unifilar" : "Abrir unifilar"}
						aria-expanded={diagramOpen}
						className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[rgba(56,216,255,0.18)] bg-[rgba(56,216,255,0.06)] px-2.5 text-xs font-medium text-[#8bdff4] transition-colors hover:border-[rgba(56,216,255,0.32)] hover:bg-[rgba(56,216,255,0.1)]"
					>
						<NetworkIcon className="size-3.5" aria-hidden="true" />
						<span className="hidden lg:inline">
							{diagramOpen ? "Ocultar" : "Abrir"} unifilar
						</span>
					</button>
					{canEdit && (canUndo || canRedo) && (
						<div className="inline-flex items-center gap-0.5">
							<button
								type="button"
								onClick={() => {
									useNetworkEditorStore.temporal.getState().undo();
									deselect();
								}}
								disabled={!canUndo}
								aria-label="Deshacer último cambio"
								title="Deshacer último cambio (Ctrl+Z)"
								className="inline-flex size-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[rgba(164,164,164,0.1)] hover:text-[#e6e6e6] disabled:opacity-40"
							>
								<Undo2 className="size-3.5" aria-hidden="true" />
							</button>
							<button
								type="button"
								onClick={() => {
									useNetworkEditorStore.temporal.getState().redo();
									deselect();
								}}
								disabled={!canRedo}
								aria-label="Rehacer"
								title="Rehacer (Ctrl+Shift+Z o Ctrl+Y)"
								className="hidden size-8 sm:inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[rgba(164,164,164,0.1)] hover:text-[#e6e6e6] disabled:opacity-40"
							>
								<Redo2 className="size-3.5" aria-hidden="true" />
							</button>
						</div>
					)}
					{isDirty && (
						<>
							<span
								role="status"
								className="inline-flex items-center gap-1.5 text-xs text-[#fbbf24]"
							>
								<span
									className="size-1.5 rounded-full bg-[#fbbf24]"
									aria-hidden="true"
								/>
								<span className="sr-only xl:not-sr-only">
									Cambios sin guardar
								</span>
							</span>
							<button
								type="button"
								onClick={handleDiscard}
								disabled={isSaving}
								className="h-8 rounded-md px-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[rgba(251,77,109,0.1)] hover:text-[#fb7185] disabled:opacity-50"
							>
								Descartar
							</button>
							<button
								type="button"
								onClick={() => void saveChanges()}
								disabled={isSaving}
								className="h-8 rounded-md border border-[rgba(52,211,153,0.35)] bg-[rgba(52,211,153,0.12)] px-3 text-xs font-medium text-[#34d399] transition-colors hover:bg-[rgba(52,211,153,0.2)] disabled:opacity-50"
							>
								{isSaving ? "Guardando…" : "Guardar"}
							</button>
						</>
					)}
					{!isDirty && networkQuery.isSuccess && (
						<span className="hidden text-xs text-[var(--text-secondary)] sm:inline">
							Todo guardado
						</span>
					)}
				</div>
			</div>

			{/* Map editor — full remaining height with min-h-0 */}
			<div className="relative min-h-0 flex-1 overflow-hidden">
				<NetworkLoadState
					isPending={networkQuery.isPending}
					isError={networkQuery.isError}
					isRefetching={networkQuery.isFetching}
					onRetry={() => void networkQuery.refetch()}
				/>
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
