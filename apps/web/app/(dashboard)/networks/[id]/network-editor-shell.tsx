"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Network } from "@/lib/types/network";
import type { UserRole } from "@/lib/types/gpon";
import {
	useNetworkEditorStore,
	type EditorMode,
} from "@/lib/store/network-editor";
import { canWriteInfrastructure } from "@/lib/types/gpon";
import { MapView } from "@/components/map/map-view";
import { MAPBOX_TOKEN } from "@/lib/mapbox/config";

const MODE_LABELS: Record<EditorMode, string> = {
	view: "Visualizar",
	design: "Diseñar",
	edit: "Editar",
};

interface Props {
	network: Network;
	networkId: string;
	userRole: UserRole | null;
}

export function NetworkEditorShell({ network, networkId, userRole }: Props) {
	const {
		mode,
		setMode,
		isDirty,
		isSaving,
		validationErrors,
		loadNetwork,
		save,
		discard,
		getElementsArray,
		getRoutesArray,
		getRoutePointsArray,
	} = useNetworkEditorStore();

	const canEdit = canWriteInfrastructure(userRole);

	useEffect(() => {
		loadNetwork(networkId);
	}, [networkId, loadNetwork]);

	const modes: EditorMode[] = canEdit ? ["view", "design", "edit"] : ["view"];

	return (
		<div className="flex h-full flex-col">
			{/* Editor topbar */}
			<div className="flex h-11 shrink-0 items-center justify-between border-b border-[rgba(164,164,164,0.14)] bg-[#1e1f20] px-4">
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

				{/* Right: dirty indicator + save */}
				<div className="flex items-center gap-3">
					{validationErrors.length > 0 && (
						<span className="text-xs text-[#f59e0b]">
							{validationErrors.length} advertencia
							{validationErrors.length > 1 ? "s" : ""}
						</span>
					)}
					{isDirty && (
						<>
							<span className="text-xs text-[#777879]">
								● Cambios sin guardar
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
					{!isDirty && (
						<span className="text-xs text-[#5c5d5f]">Guardado</span>
					)}
				</div>
			</div>

			{/* Map editor — full remaining height */}
			<div className="flex-1 overflow-hidden">
				<MapView
					token={MAPBOX_TOKEN}
					equipment={getElementsArray()}
					connections={getRoutesArray()}
					routePoints={getRoutePointsArray()}
					incidents={[]}
					userRole={userRole}
				/>
			</div>
		</div>
	);
}
