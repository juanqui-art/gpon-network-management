"use client";

import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	LocateFixed,
	Plus,
	Save,
	SlidersHorizontal,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NetworkEditorMap } from "@/components/map/network-editor-map";
import type {
	ConnectionMapItem,
	EquipmentMapItem,
	FiberRoute,
	InfrastructureElement,
	RoutePoint,
} from "@/components/map/types";
import { generateDraftCode, nextSequence } from "@/lib/gpon/operative-code";
import { useNetworkEditorHistoryShortcuts } from "@/lib/hooks/use-network-editor-history-shortcuts";
import { calculateRouteLengthMeters } from "@/lib/map/route-geometry-editor";
import { MAPBOX_TOKEN } from "@/lib/mapbox/config";
import {
	fetchNetworkEditorData,
	networkEditorKeys,
} from "@/lib/queries/network-editor";
import { useNetworkEditorStore } from "@/lib/store/network-editor";
import type {
	ElementStatus,
	ElementType,
	RoutePointType,
	RouteStatus,
	RouteType,
	SplitRatio,
} from "@/lib/types/gpon";
import { SPLITTER_INSERTION_LOSS_DB } from "@/lib/types/gpon";
import type { Network } from "@/lib/types/network";

type CaptureType = Extract<ElementType, "olt" | "nap" | "closure">;
type CaptureIssueLevel = "error" | "warning";

interface CaptureIssue {
	id: string;
	level: CaptureIssueLevel;
	message: string;
}

const CAPTURE_ELEMENT_TYPES: Array<Extract<CaptureType, "olt" | "nap">> = [
	"olt",
	"nap",
];

const TYPE_LABELS: Record<CaptureType, string> = {
	olt: "OLT",
	nap: "NAP",
	closure: "Mufa",
};

function isQuickCaptureType(type: ElementType): type is CaptureType {
	return type === "olt" || type === "nap" || type === "closure";
}

function isCaptureElementType(type: string): type is ElementType {
	return (
		type === "olt" ||
		type === "splitter" ||
		type === "nap" ||
		type === "closure"
	);
}

function describeMufaProperties(properties: Record<string, unknown>) {
	const details = [];
	if (properties.has_midspan_access === true) details.push("sangrado");
	if (properties.has_splice === true) details.push("empalme");
	if (properties.has_splitter === true) details.push("splitter");
	return details.length > 0 ? `mufa + ${details.join(" + ")}` : "mufa";
}

function buildCaptureIssues(
	elements: EquipmentMapItem[],
	routes: ConnectionMapItem[],
): CaptureIssue[] {
	const issues: CaptureIssue[] = [];
	const connectedElementIds = new Set<string>();

	for (const route of routes) {
		if (route.from_element_id) connectedElementIds.add(route.from_element_id);
		if (route.to_element_id) connectedElementIds.add(route.to_element_id);
		if (!route.from_element_id || !route.to_element_id) {
			issues.push({
				id: `route-${route.id}-endpoints`,
				level: "error",
				message: `${route.code ?? "Fibra"} necesita origen y destino.`,
			});
		}
		if (route.geojson_coordinates.length < 2) {
			issues.push({
				id: `route-${route.id}-geometry`,
				level: "error",
				message: `${route.code ?? "Fibra"} necesita un trazado válido.`,
			});
		}
		if (!route.fiber_count || route.fiber_count <= 0) {
			issues.push({
				id: `route-${route.id}-fiber-count`,
				level: "warning",
				message: `${route.code ?? "Fibra"} no tiene cantidad de hilos.`,
			});
		}
	}

	if (
		elements.length > 0 &&
		!elements.some((element) => element.type === "olt")
	) {
		issues.push({
			id: "network-missing-olt",
			level: "error",
			message: "La captura necesita al menos una OLT como referencia.",
		});
	}

	for (const element of elements) {
		if (
			element.type === "closure" &&
			element.properties.has_splitter === true &&
			!element.split_ratio
		) {
			issues.push({
				id: `element-${element.id}-splitter-ratio`,
				level: "error",
				message: `${element.code} tiene splitter, pero no tiene ratio.`,
			});
		}
		if (element.type === "nap" && !element.total_ports) {
			issues.push({
				id: `element-${element.id}-ports`,
				level: "warning",
				message: `${element.code} no tiene capacidad de puertos.`,
			});
		}
		if (elements.length > 1 && !connectedElementIds.has(element.id)) {
			issues.push({
				id: `element-${element.id}-isolated`,
				level: "warning",
				message: `${element.code} está aislado, sin fibra conectada.`,
			});
		}
	}

	return issues;
}

const DEFAULTS_BY_TYPE: Record<
	CaptureType,
	{
		status: ElementStatus;
		splitRatio: SplitRatio | "";
		totalPorts: string;
		insertionLossDb: string;
	}
> = {
	olt: {
		status: "planned",
		splitRatio: "",
		totalPorts: "",
		insertionLossDb: "",
	},
	nap: {
		status: "planned",
		splitRatio: "1:8",
		totalPorts: "8",
		insertionLossDb: "10.5",
	},
	closure: {
		status: "planned",
		splitRatio: "",
		totalPorts: "",
		insertionLossDb: "",
	},
};

interface Props {
	canCapture: boolean;
	network: Network;
	networkId: string;
}

export function NetworkCaptureShell({ canCapture, network, networkId }: Props) {
	const networkQuery = useQuery({
		queryKey: networkEditorKeys.detail(networkId),
		queryFn: () => fetchNetworkEditorData(networkId),
	});
	const {
		activeTool,
		addElement,
		addRoute,
		addRoutePoint,
		deselect,
		getElementsArray,
		getRoutePointsArray,
		getRoutesArray,
		hydrateNetwork,
		insertRouteVertex,
		moveRouteVertex,
		save,
		select,
		selection,
		setActiveTool,
		setMode,
		updateElement,
		updateRoute,
		updateRoutePoint,
		isDirty,
		isSaving,
	} = useNetworkEditorStore();

	const [type, setType] = useState<CaptureType>("nap");
	const [zone, setZone] = useState("Z05");
	const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);
	const [pendingClosureProperties, setPendingClosureProperties] =
		useState<Record<string, unknown> | null>(null);
	const [pendingClosureLabel, setPendingClosureLabel] = useState("Mufa");
	const [routeSourceId, setRouteSourceId] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState(
		"Click derecho para elegir OLT, NAP o mufa; luego click izquierdo para colocar.",
	);

	const { canRedo, canUndo } = useNetworkEditorHistoryShortcuts({
		enabled: canCapture,
		onHistoryChange: setStatusMessage,
	});

	useEffect(() => {
		setMode("design");
		setActiveTool("select");
	}, [setActiveTool, setMode]);

	useEffect(() => {
		if (networkQuery.data) {
			hydrateNetwork(networkId, networkQuery.data);
		}
	}, [hydrateNetwork, networkId, networkQuery.data]);

	useEffect(() => {
		if (!routeSourceId) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setRouteSourceId(null);
			setActiveTool("select");
			setStatusMessage("Creación de fibra cancelada.");
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [routeSourceId, setActiveTool]);

	const elements = getElementsArray();
	const routes = getRoutesArray();
	const routePoints = getRoutePointsArray();
	const suggestedCode = useMemo(() => {
		const existingCodes = elements
			.filter((element) => element.type === type)
			.map((element) => element.code);
		return generateDraftCode(type, nextSequence(existingCodes), zone);
	}, [elements, type, zone]);
	const routeSource = routeSourceId
		? elements.find((element) => element.id === routeSourceId)
		: null;
	const selectedElement =
		selection?.kind === "element"
			? (elements.find((element) => element.id === selection.id) ?? null)
			: null;
	const selectedRoute =
		selection?.kind === "route"
			? (routes.find((route) => route.id === selection.id) ?? null)
			: null;
	const selectedRoutePoint =
		selection?.kind === "routePoint"
			? (routePoints.find((point) => point.id === selection.id) ?? null)
			: null;

	const equipment = useMemo(
		() =>
			elements.map(
				(element) =>
					({
						...element,
						vendor: null,
						model: null,
						address: element.address_reference,
						service_status: null,
						plan_name: null,
						download_mbps: null,
						upload_mbps: null,
						customer_name: null,
						customer_phone: null,
						rx_power_dbm: null,
						tx_power_dbm: null,
						signal_recorded_at: null,
					}) satisfies EquipmentMapItem,
			),
		[elements],
	);
	const connections = useMemo(
		() =>
			routes.map(
				(route) =>
					({
						...route,
						cable_type: route.type,
						from_equipment_id: route.from_element_id ?? "",
						to_equipment_id: route.to_element_id ?? "",
						from_equipment_type: route.from_element_type ?? "olt",
						to_equipment_type: route.to_element_type ?? "nap",
					}) satisfies ConnectionMapItem,
			),
		[routes],
	);
	const captureIssues = useMemo(
		() => buildCaptureIssues(equipment, connections),
		[equipment, connections],
	);
	const captureErrorCount = captureIssues.filter(
		(issue) => issue.level === "error",
	).length;
	const captureWarningCount = captureIssues.length - captureErrorCount;

	const codeForType = (elementType: CaptureType) => {
		if (elementType === type) return suggestedCode;
		const existingCodes = elements
			.filter((element) => element.type === elementType)
			.map((element) => element.code);
		return generateDraftCode(elementType, nextSequence(existingCodes), zone);
	};

	const inferRouteType = (
		from: InfrastructureElement | EquipmentMapItem,
		to: InfrastructureElement | EquipmentMapItem,
	): RouteType =>
		from.type === "olt" || to.type === "olt" ? "feeder" : "distribution";

	const codeForRoute = (routeType: RouteType) => {
		const existingCodes = routes
			.filter((route) => route.type === routeType)
			.map((route) => route.code)
			.filter((routeCode): routeCode is string => routeCode !== null);
		return generateDraftCode(routeType, nextSequence(existingCodes), zone);
	};

	const codeForRoutePoint = (pointType: RoutePointType) => {
		const existingCodes = routePoints
			.filter((point) => point.type === pointType)
			.map((point) => point.code)
			.filter((pointCode): pointCode is string => pointCode !== null);
		return generateDraftCode(pointType, nextSequence(existingCodes), zone);
	};

	const handleTypeChange = (nextType: CaptureType) => {
		setType(nextType);
		if (nextType !== "closure") {
			setPendingClosureProperties(null);
			setPendingClosureLabel("Mufa");
		}
	};

	const selectCreateTool = (elementType: CaptureType) => {
		setRouteSourceId(null);
		handleTypeChange(elementType);
		setActiveTool(elementType);
		setStatusMessage(
			`${TYPE_LABELS[elementType]} listo: haz click izquierdo en el mapa para colocarlo.`,
		);
	};

	const selectClosureTool = (
		properties: Record<string, unknown>,
		label: string,
	) => {
		setRouteSourceId(null);
		setType("closure");
		setPendingClosureProperties({ closure_type: "mufa", ...properties });
		setPendingClosureLabel(label);
		setActiveTool("closure");
		setStatusMessage(
			`${label} lista: haz click izquierdo en el mapa para colocarla como nodo conectable.`,
		);
	};

	const createDraftElement = (
		elementType: CaptureType,
		position: { lng: number; lat: number },
	) => {
		if (!canCapture) {
			setStatusMessage("Tu rol no permite crear infraestructura.");
			return;
		}
		const defaults = DEFAULTS_BY_TYPE[elementType];
		const closureProperties =
			elementType === "closure"
				? (pendingClosureProperties ?? { closure_type: "mufa" })
				: null;
		const closureSplitRatio =
			closureProperties?.has_splitter === true &&
			typeof closureProperties.split_ratio === "string"
				? (closureProperties.split_ratio as SplitRatio)
				: null;
		const now = new Date().toISOString();
		const draft: InfrastructureElement = {
			id: crypto.randomUUID(),
			organization_id: null,
			type: elementType,
			code: codeForType(elementType),
			name: null,
			status: defaults.status,
			lng: position.lng,
			lat: position.lat,
			location_quality: "drawn",
			address_reference: null,
			pon_standard: elementType === "olt" ? "gpon" : null,
			total_pon_ports: elementType === "olt" ? 16 : null,
			optical_class: elementType === "olt" ? "B+" : null,
			management_ip: null,
			split_ratio:
				closureSplitRatio ??
				(elementType === "olt" || defaults.splitRatio === ""
					? null
					: defaults.splitRatio),
			insertion_loss_db: closureSplitRatio
				? SPLITTER_INSERTION_LOSS_DB[closureSplitRatio]
				: elementType === "olt" || defaults.insertionLossDb === ""
					? null
					: Number(defaults.insertionLossDb),
			total_ports: closureSplitRatio
				? Number(closureSplitRatio.split(":")[1])
				: elementType === "olt" || defaults.totalPorts === ""
					? null
					: Number(defaults.totalPorts),
			ports_used: null,
			ports_reserved: null,
			properties:
				elementType === "closure"
					? (closureProperties ?? { closure_type: "mufa" })
					: elementType === "nap"
						? {
								nap_mode: defaults.splitRatio ? "with_splitter" : "splice_only",
							}
						: {},
			notes: null,
			created_by: null,
			updated_by: null,
			created_at: now,
			updated_at: now,
		};

		addElement(draft);
		select(draft.id, "element");
		setLastCreatedCode(draft.code);
		setStatusMessage(
			`${draft.code} ${elementType === "closure" ? `(${pendingClosureLabel}) ` : ""}creado localmente en esta sesión. Aún no se guarda en la base de datos.`,
		);
		setPendingClosureProperties(null);
		setPendingClosureLabel("Mufa");
		setActiveTool("select");
	};

	const startRouteFromElement = (element: EquipmentMapItem) => {
		if (!canCapture) {
			setStatusMessage("Tu rol no permite crear rutas de fibra.");
			return;
		}
		if (
			element.type !== "olt" &&
			element.type !== "splitter" &&
			element.type !== "nap" &&
			element.type !== "closure"
		) {
			setStatusMessage("Solo se pueden conectar OLT, Mufa, Splitter y NAP.");
			return;
		}
		setRouteSourceId(element.id);
		setActiveTool("fiber");
		select(element.id, "element");
		setStatusMessage(
			`${element.code}: origen de fibra seleccionado. Haz click en otro elemento para conectarlo. Esc cancela.`,
		);
	};

	const createDraftRoute = (fromId: string, toId: string) => {
		const from = elements.find((element) => element.id === fromId);
		const to = elements.find((element) => element.id === toId);
		if (!from || !to) {
			setStatusMessage("No se pudo crear la fibra: origen o destino inválido.");
			return;
		}
		if (!isCaptureElementType(from.type) || !isCaptureElementType(to.type)) {
			setStatusMessage("Solo se pueden conectar OLT, Mufa, Splitter y NAP.");
			return;
		}
		if (from.id === to.id) {
			setStatusMessage("Elige un elemento diferente para cerrar la fibra.");
			return;
		}

		const routeType = inferRouteType(from, to);
		const coordinates: Array<[number, number]> = [
			[from.lng, from.lat],
			[to.lng, to.lat],
		];
		const now = new Date().toISOString();
		const draft: FiberRoute = {
			id: crypto.randomUUID(),
			organization_id: null,
			code: codeForRoute(routeType),
			type: routeType,
			status: "planned",
			from_element_id: from.id,
			to_element_id: to.id,
			from_element_type: from.type,
			to_element_type: to.type,
			geojson_coordinates: coordinates,
			route_quality: "drawn",
			installation_type: null,
			fiber_type: null,
			fiber_count: 12,
			length_meters: calculateRouteLengthMeters(coordinates),
			reservation_m: 0,
			attenuation_db_per_km: null,
			splice_loss_db: null,
			connector_loss_db: null,
			total_loss_db: null,
			properties: {},
			notes: null,
			created_by: null,
			updated_by: null,
			created_at: now,
			updated_at: now,
		};

		addRoute(draft);
		select(draft.id, "route");
		setRouteSourceId(null);
		setActiveTool("select");
		setLastCreatedCode(draft.code);
		setStatusMessage(
			`${draft.code}: fibra creada localmente entre ${from.code} y ${to.code}.`,
		);
	};

	const createDraftRoutePoint = ({
		position,
		properties,
		route,
		type: pointType,
	}: {
		position: { lng: number; lat: number };
		properties?: Record<string, unknown>;
		route: ConnectionMapItem;
		type: RoutePointType;
	}) => {
		if (!canCapture) {
			setStatusMessage("Tu rol no permite crear puntos físicos.");
			return;
		}
		const now = new Date().toISOString();
		const draft = {
			id: crypto.randomUUID(),
			organization_id: null,
			fiber_route_id: route.id,
			type: pointType,
			code: codeForRoutePoint(pointType),
			status: "planned",
			lng: position.lng,
			lat: position.lat,
			location_quality: "drawn" as const,
			position_on_route_m: null,
			reserve_length_m: null,
			splice_loss_db: null,
			crossing_type: null,
			risk_level: null,
			reference_text: null,
			properties:
				pointType === "mufa"
					? { closure_type: "mufa", ...properties }
					: (properties ?? {}),
			notes: null,
			created_by: null,
			updated_by: null,
			created_at: now,
			updated_at: now,
		};

		addRoutePoint(draft);
		select(draft.id, "routePoint");
		setLastCreatedCode(draft.code);
		const mufaDescription = describeMufaProperties(draft.properties);
		setStatusMessage(
			`${draft.code}: ${mufaDescription} agregada localmente sobre ${route.code ?? "la ruta"}.`,
		);
	};

	const handleMapSelection = (
		nextSelection: {
			id: string;
			kind: "element" | "route" | "routePoint";
		} | null,
	) => {
		if (routeSourceId && nextSelection?.kind === "element") {
			createDraftRoute(routeSourceId, nextSelection.id);
			return;
		}
		if (nextSelection) {
			select(nextSelection.id, nextSelection.kind);
		} else {
			deselect();
		}
	};

	const updateSelectedElement = (
		id: string,
		patch: Partial<InfrastructureElement>,
	) => {
		updateElement(id, patch);
		setStatusMessage("Datos mínimos del elemento actualizados localmente.");
	};

	const updateSelectedRoute = (id: string, patch: Partial<FiberRoute>) => {
		updateRoute(id, patch);
		setStatusMessage("Datos mínimos de la fibra actualizados localmente.");
	};

	const updateSelectedRoutePoint = (
		id: string,
		patch: Partial<(typeof routePoints)[number]>,
	) => {
		updateRoutePoint(id, patch);
		setStatusMessage("Datos mínimos del punto físico actualizados localmente.");
	};

	const persistCapture = async () => {
		setStatusMessage("Guardando captura en la base de datos...");
		await save();
		setStatusMessage(useNetworkEditorStore.getState().statusMessage);
	};

	return (
		<div className="flex h-full min-h-0 flex-col bg-[#151617]">
			<header className="flex h-12 shrink-0 items-center justify-between border-b border-[rgba(164,164,164,0.14)] bg-[#1e1f20] px-4">
				<div className="flex min-w-0 items-center gap-3">
					<Link
						href={`/networks/${networkId}`}
						className="inline-flex items-center gap-1.5 text-xs text-[#777879] transition-colors hover:text-[#d7d7d7]"
					>
						<ArrowLeft className="size-3.5" aria-hidden="true" />
						Inventario
					</Link>
					<span className="text-[rgba(164,164,164,0.3)]">/</span>
					<div className="min-w-0">
						<p className="truncate text-xs font-medium text-[#e6e6e6]">
							{network.name}
						</p>
						<p className="text-[10px] uppercase tracking-[0.14em] text-[#777879]">
							Captura rápida
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Link
						href={`/networks/${networkId}`}
						className="rounded-md border border-[rgba(164,164,164,0.14)] bg-[rgba(164,164,164,0.06)] px-3 py-1.5 text-xs text-[#d7d7d7] transition-colors hover:bg-[rgba(164,164,164,0.1)]"
					>
						Ver mapa
					</Link>
					<button
						type="button"
						disabled={!canCapture || !isDirty || isSaving}
						onClick={persistCapture}
						className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(52,211,153,0.28)] bg-[rgba(52,211,153,0.1)] px-3 py-1.5 text-xs font-semibold text-[#86efac] transition-colors hover:bg-[rgba(52,211,153,0.16)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Save className="size-3.5" aria-hidden="true" />
						{isSaving ? "Guardando..." : "Guardar"}
					</button>
				</div>
			</header>

			<main className="grid min-h-0 flex-1 grid-cols-[minmax(360px,420px)_1fr] overflow-hidden">
				<section className="min-h-0 overflow-y-auto border-r border-[rgba(164,164,164,0.14)] bg-[radial-gradient(circle_at_20%_0%,rgba(56,216,255,0.1),transparent_34%),#1b1c1d] p-4">
					<div className="mb-3 overflow-hidden rounded-xl border border-[rgba(56,216,255,0.2)] bg-[linear-gradient(135deg,rgba(56,216,255,0.12),rgba(164,164,164,0.035)_55%,rgba(17,18,19,0.7))] p-3 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7ddfff]">
									Captura de campo
								</p>
								<p className="mt-1 text-sm font-semibold text-[#e6e6e6]">
									Alta rápida de infraestructura
								</p>
							</div>
							<div className="rounded-lg border border-[rgba(56,216,255,0.24)] bg-[rgba(56,216,255,0.1)] p-2">
								<Zap className="size-4 text-[#38d8ff]" aria-hidden="true" />
							</div>
						</div>
						<p className="mt-2 text-xs leading-5 text-[#9fa6ad]">
							Dibuja primero; completa datos mínimos solo cuando el mapa ya
							tenga sentido.
						</p>
					</div>

					<CaptureFlowSteps
						hasRouteSource={Boolean(routeSourceId)}
						hasSelection={Boolean(selection)}
					/>

					<div className="mt-3 rounded-xl border border-[rgba(164,164,164,0.12)] bg-[rgba(17,18,19,0.55)] p-3">
						<div className="mb-3 flex items-center gap-2">
							<span className="flex size-6 items-center justify-center rounded-md bg-[rgba(56,216,255,0.1)] text-[10px] font-bold text-[#8bdff4]">
								01
							</span>
							<p className="text-sm font-semibold text-[#e6e6e6]">
								Alta rápida de infraestructura
							</p>
						</div>

						{!canCapture && (
							<div className="mb-4 rounded-md border border-[rgba(251,77,109,0.28)] bg-[rgba(251,77,109,0.08)] p-3 text-xs text-[#fb7185]">
								Tu rol puede consultar esta red, pero no crear infraestructura.
							</div>
						)}

						<form
							className="space-y-4"
							onSubmit={(event) => {
								event.preventDefault();
								selectCreateTool(type);
							}}
						>
							<div>
								<span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
									Tipo
								</span>
								<div className="grid grid-cols-2 gap-1.5">
									{CAPTURE_ELEMENT_TYPES.map((item) => (
										<button
											key={item}
											type="button"
											onClick={() => handleTypeChange(item)}
											className="rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all hover:-translate-y-0.5"
											style={{
												backgroundColor:
													type === item
														? "rgba(56,216,255,0.16)"
														: "rgba(164,164,164,0.04)",
												borderColor:
													type === item
														? "rgba(56,216,255,0.35)"
														: "rgba(164,164,164,0.12)",
												color: type === item ? "#8bdff4" : "#a4a4a4",
											}}
										>
											{TYPE_LABELS[item]}
										</button>
									))}
								</div>
							</div>

							<div className="grid grid-cols-[1fr_96px] gap-3">
								<div className="rounded-md border border-[rgba(164,164,164,0.12)] bg-[#111213] px-3 py-2">
									<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
										Próximo código
									</p>
									<p className="mt-1 font-mono text-sm font-semibold text-[#e6e6e6]">
										{suggestedCode}
									</p>
								</div>
								<label className="block">
									<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
										Zona
									</span>
									<input
										value={zone}
										onChange={(event) => setZone(event.target.value)}
										className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#111213] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none focus:border-[#38d8ff]/40"
									/>
								</label>
							</div>

							{lastCreatedCode && (
								<p className="flex items-center gap-2 rounded-md border border-[rgba(52,211,153,0.22)] bg-[rgba(52,211,153,0.08)] px-3 py-2 text-xs text-[#86efac]">
									<CheckCircle2 className="size-3.5" aria-hidden="true" />
									{lastCreatedCode} creado localmente
								</p>
							)}

							<div className="grid gap-2">
								<button
									type="button"
									disabled={!canCapture}
									onClick={() => selectCreateTool(type)}
									className="flex items-center justify-center gap-2 rounded-md border border-[rgba(56,216,255,0.3)] bg-[rgba(56,216,255,0.1)] px-3 py-2.5 text-xs font-semibold text-[#8bdff4] transition-colors hover:bg-[rgba(56,216,255,0.16)] disabled:cursor-not-allowed disabled:opacity-50"
								>
									<Plus className="size-4" aria-hidden="true" />
									Preparar herramienta
								</button>
								<p className="text-[11px] leading-5 text-[#777879]">
									Las capturas se visualizan al instante y viven en Zustand por
									ahora. Usa Ctrl+Z fuera del formulario para revertir el último
									cambio.
								</p>
							</div>
						</form>
					</div>

					<CaptureSelectionEditor
						element={selectedElement}
						route={selectedRoute}
						routePoint={selectedRoutePoint}
						onUpdateElement={updateSelectedElement}
						onUpdateRoute={updateSelectedRoute}
						onUpdateRoutePoint={updateSelectedRoutePoint}
					/>

					<div
						className={`mt-4 rounded-xl border p-3 ${
							captureIssues.length === 0
								? "border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.07)]"
								: captureErrorCount > 0
									? "border-[rgba(251,77,109,0.24)] bg-[rgba(251,77,109,0.08)]"
									: "border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.08)]"
						}`}
					>
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								<span className="flex size-6 items-center justify-center rounded-md bg-[rgba(245,158,11,0.1)] text-[10px] font-bold text-[#fbbf24]">
									03
								</span>
								<AlertTriangle
									className={`size-4 ${
										captureIssues.length === 0
											? "text-[#86efac]"
											: captureErrorCount > 0
												? "text-[#fb7185]"
												: "text-[#fbbf24]"
									}`}
									aria-hidden="true"
								/>
								<p className="text-xs font-semibold text-[#e6e6e6]">
									Revisión rápida
								</p>
							</div>
							<span className="font-mono text-[10px] text-[#8f969e]">
								{captureErrorCount} errores · {captureWarningCount} avisos
							</span>
						</div>
						{captureIssues.length === 0 ? (
							<p className="mt-2 text-[11px] leading-5 text-[#86efac]">
								Sin alertas locales por ahora. Buen trazo, seguimos ligeros.
							</p>
						) : (
							<div className="mt-2 space-y-1.5">
								{captureIssues.slice(0, 4).map((issue) => (
									<p
										key={issue.id}
										className={`rounded border px-2 py-1.5 text-[11px] leading-4 ${
											issue.level === "error"
												? "border-[rgba(251,77,109,0.18)] bg-[rgba(251,77,109,0.06)] text-[#fda4af]"
												: "border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.06)] text-[#fcd58d]"
										}`}
									>
										{issue.message}
									</p>
								))}
								{captureIssues.length > 4 && (
									<p className="text-[11px] text-[#777879]">
										+{captureIssues.length - 4} pendientes más.
									</p>
								)}
							</div>
						)}
					</div>
				</section>

				<section className="relative min-h-0 overflow-hidden">
					<NetworkEditorMap
						token={MAPBOX_TOKEN}
						equipment={equipment}
						connections={connections}
						routePoints={routePoints}
						mode="design"
						activeTool={activeTool}
						chrome="minimal"
						createElementTypes={CAPTURE_ELEMENT_TYPES}
						draftRouteSourceId={routeSourceId}
						selection={selection}
						onMapPlacement={(position) => {
							if (
								activeTool === "olt" ||
								activeTool === "nap" ||
								activeTool === "closure"
							) {
								createDraftElement(activeTool, position);
							}
						}}
						onMapToolSelect={(elementType) => {
							if (isQuickCaptureType(elementType)) {
								selectCreateTool(elementType);
							}
						}}
						onMapClosureToolSelect={selectClosureTool}
						onSelectionChange={handleMapSelection}
						onStartRouteFromElement={startRouteFromElement}
						onInsertRouteVertex={insertRouteVertex}
						onMoveRouteVertex={moveRouteVertex}
						onCreateRoutePoint={createDraftRoutePoint}
						onStatusMessageChange={setStatusMessage}
					/>
					{routeSource && (
						<div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-lg border border-[rgba(56,216,255,0.28)] bg-[rgba(17,18,19,0.92)] px-3 py-2 text-xs text-[#8bdff4] shadow-2xl backdrop-blur-md">
							<span className="font-semibold">{routeSource.code}</span>: click
							en el elemento destino para crear fibra · Esc cancela
						</div>
					)}
					<div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex items-start justify-between gap-3">
						<div className="pointer-events-auto max-w-xl rounded-lg border border-[rgba(56,216,255,0.22)] bg-[rgba(17,18,19,0.9)] px-3 py-2 text-xs text-[#bdeafe] shadow-2xl backdrop-blur-md">
							<p className="font-semibold">
								Click derecho elige herramienta · click izquierdo coloca
							</p>
							<p className="mt-0.5 text-[#8f969e]">{statusMessage}</p>
						</div>
						<div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-[rgba(164,164,164,0.14)] bg-[rgba(17,18,19,0.88)] px-2.5 py-1.5 text-xs text-[#8f969e] shadow-2xl backdrop-blur-md">
							<span className="inline-flex items-center gap-1.5 text-[#8bdff4]">
								<LocateFixed className="size-3.5" aria-hidden="true" />
								{equipment.length}
							</span>
							<span className="h-3 w-px bg-white/10" />
							<span title="Ctrl+Z deshace. Ctrl+Shift+Z o Ctrl+Y rehace.">
								{canUndo ? "Ctrl+Z" : "Sin historial"}
								{canRedo ? " · rehacer" : ""}
							</span>
						</div>
					</div>
				</section>
			</main>
		</div>
	);
}

function CaptureSelectionEditor({
	element,
	onUpdateElement,
	onUpdateRoute,
	onUpdateRoutePoint,
	route,
	routePoint,
}: {
	element: EquipmentMapItem | null;
	route: ConnectionMapItem | null;
	routePoint: RoutePoint | null;
	onUpdateElement: (id: string, patch: Partial<InfrastructureElement>) => void;
	onUpdateRoute: (id: string, patch: Partial<FiberRoute>) => void;
	onUpdateRoutePoint: (id: string, patch: Partial<RoutePoint>) => void;
}) {
	const selected = element ?? route ?? routePoint;
	if (!selected) {
		return (
			<div className="mt-4 rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.04)] p-3 text-xs text-[#8f969e]">
				<div className="flex items-center gap-2 text-[#d7d7d7]">
					<span className="flex size-6 items-center justify-center rounded-md bg-[rgba(164,164,164,0.08)] text-[10px] font-bold text-[#777879]">
						02
					</span>
					<SlidersHorizontal className="size-4 text-[#8bdff4]" />
					<span className="font-semibold">Editar selección</span>
				</div>
				<p className="mt-2 leading-5">
					Selecciona una OLT, mufa, NAP o fibra para ajustar datos mínimos.
				</p>
			</div>
		);
	}

	return (
		<div className="mt-4 rounded-xl border border-[rgba(56,216,255,0.16)] bg-[linear-gradient(180deg,rgba(56,216,255,0.06),rgba(17,18,19,0.86))] p-3">
			<div className="mb-3 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<span className="flex size-6 items-center justify-center rounded-md bg-[rgba(56,216,255,0.1)] text-[10px] font-bold text-[#8bdff4]">
						02
					</span>
					<SlidersHorizontal className="size-4 text-[#8bdff4]" />
					<p className="text-xs font-semibold text-[#e6e6e6]">
						Editar selección
					</p>
				</div>
				<span className="font-mono text-[10px] text-[#777879]">
					{selected.code ?? "Sin código"}
				</span>
			</div>

			{element && (
				<ElementMiniEditor element={element} onUpdate={onUpdateElement} />
			)}
			{route && <RouteMiniEditor route={route} onUpdate={onUpdateRoute} />}
			{routePoint && (
				<RoutePointMiniEditor
					point={routePoint}
					onUpdate={onUpdateRoutePoint}
				/>
			)}
		</div>
	);
}

function CaptureFlowSteps({
	hasRouteSource,
	hasSelection,
}: {
	hasRouteSource: boolean;
	hasSelection: boolean;
}) {
	const steps = [
		{
			active: !hasRouteSource && !hasSelection,
			label: "Crear",
			text: "Click derecho y coloca OLT, mufa o NAP.",
		},
		{
			active: hasRouteSource,
			label: "Conectar",
			text: "Elige destino para cerrar la fibra.",
		},
		{
			active: hasSelection && !hasRouteSource,
			label: "Afinar",
			text: "Edita datos mínimos del seleccionado.",
		},
	];

	return (
		<div className="grid grid-cols-3 gap-1.5">
			{steps.map((step, index) => (
				<div
					key={step.label}
					className={`rounded-lg border px-2.5 py-2 transition-colors ${
						step.active
							? "border-[rgba(56,216,255,0.34)] bg-[rgba(56,216,255,0.1)]"
							: "border-[rgba(164,164,164,0.1)] bg-[rgba(164,164,164,0.035)]"
					}`}
				>
					<div className="flex items-center gap-1.5">
						<span
							className={`font-mono text-[10px] ${
								step.active ? "text-[#8bdff4]" : "text-[#777879]"
							}`}
						>
							0{index + 1}
						</span>
						<p
							className={`text-[11px] font-semibold ${
								step.active ? "text-[#dff8ff]" : "text-[#a4a4a4]"
							}`}
						>
							{step.label}
						</p>
					</div>
					<p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#777879]">
						{step.text}
					</p>
				</div>
			))}
		</div>
	);
}

function ElementMiniEditor({
	element,
	onUpdate,
}: {
	element: EquipmentMapItem;
	onUpdate: (id: string, patch: Partial<InfrastructureElement>) => void;
}) {
	const hasSplitter =
		element.type === "closure" && element.properties.has_splitter === true;
	return (
		<div className="space-y-3">
			<div className="grid grid-cols-2 gap-2">
				<CaptureTextField
					label="Nombre"
					value={element.name ?? ""}
					onChange={(value) => onUpdate(element.id, { name: value || null })}
				/>
				<CaptureSelectField
					label="Estado"
					value={element.status}
					options={[
						["planned", "Planificado"],
						["active", "Activo"],
						["inactive", "Inactivo"],
						["faulty", "Falla"],
					]}
					onChange={(value) =>
						onUpdate(element.id, { status: value as ElementStatus })
					}
				/>
			</div>

			{element.type === "closure" && (
				<div className="rounded-md border border-[rgba(56,216,255,0.14)] bg-[rgba(56,216,255,0.05)] p-2">
					<p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#8bdff4]">
						Mufa
					</p>
					<div className="grid grid-cols-2 gap-2">
						<CaptureCheckboxField
							checked={element.properties.has_midspan_access === true}
							label="Sangrado"
							onChange={(checked) =>
								onUpdate(element.id, {
									properties: {
										...element.properties,
										has_midspan_access: checked,
									},
								})
							}
						/>
						<CaptureCheckboxField
							checked={element.properties.has_splice === true}
							label="Empalme"
							onChange={(checked) =>
								onUpdate(element.id, {
									properties: { ...element.properties, has_splice: checked },
								})
							}
						/>
						<CaptureCheckboxField
							checked={hasSplitter}
							label="Splitter"
							onChange={(checked) => {
								const splitRatio = checked
									? (element.split_ratio ?? "1:4")
									: null;
								onUpdate(element.id, {
									split_ratio: splitRatio,
									insertion_loss_db: splitRatio
										? SPLITTER_INSERTION_LOSS_DB[splitRatio]
										: null,
									total_ports: splitRatio
										? Number(splitRatio.split(":")[1])
										: null,
									properties: {
										...element.properties,
										has_splitter: checked,
										split_ratio: splitRatio,
									},
								});
							}}
						/>
						{hasSplitter && (
							<CaptureSelectField
								label="Ratio"
								value={element.split_ratio ?? "1:4"}
								options={[
									["1:2", "1:2"],
									["1:4", "1:4"],
									["1:8", "1:8"],
									["1:16", "1:16"],
									["1:32", "1:32"],
								]}
								onChange={(value) => {
									const splitRatio = value as SplitRatio;
									onUpdate(element.id, {
										split_ratio: splitRatio,
										insertion_loss_db: SPLITTER_INSERTION_LOSS_DB[splitRatio],
										total_ports: Number(splitRatio.split(":")[1]),
										properties: {
											...element.properties,
											has_splitter: true,
											split_ratio: splitRatio,
										},
									});
								}}
							/>
						)}
					</div>
				</div>
			)}

			{element.type === "nap" && (
				<div className="grid grid-cols-2 gap-2">
					<CaptureNumberField
						label="Puertos"
						value={element.total_ports}
						onChange={(value) => onUpdate(element.id, { total_ports: value })}
					/>
					<CaptureSelectField
						label="Ratio"
						value={element.split_ratio ?? ""}
						options={[
							["", "Sin splitter"],
							["1:8", "1:8"],
							["1:16", "1:16"],
							["1:32", "1:32"],
						]}
						onChange={(value) =>
							onUpdate(element.id, {
								split_ratio: value ? (value as SplitRatio) : null,
								insertion_loss_db: value
									? SPLITTER_INSERTION_LOSS_DB[value as SplitRatio]
									: null,
								properties: {
									...element.properties,
									nap_mode: value ? "with_splitter" : "terminal",
								},
							})
						}
					/>
				</div>
			)}

			<CaptureTextField
				label="Notas"
				value={element.notes ?? ""}
				onChange={(value) => onUpdate(element.id, { notes: value || null })}
			/>
		</div>
	);
}

function RouteMiniEditor({
	onUpdate,
	route,
}: {
	route: ConnectionMapItem;
	onUpdate: (id: string, patch: Partial<FiberRoute>) => void;
}) {
	return (
		<div className="space-y-3">
			<div className="grid grid-cols-2 gap-2">
				<CaptureNumberField
					label="Hilos"
					value={route.fiber_count}
					onChange={(value) => onUpdate(route.id, { fiber_count: value })}
				/>
				<CaptureSelectField
					label="Estado"
					value={route.status}
					options={[
						["planned", "Planificada"],
						["installed", "Instalada"],
						["active", "Activa"],
						["damaged", "Dañada"],
					]}
					onChange={(value) =>
						onUpdate(route.id, { status: value as RouteStatus })
					}
				/>
			</div>
			<CaptureSelectField
				label="Tipo"
				value={route.type}
				options={[
					["feeder", "Feeder"],
					["distribution", "Distribución"],
					["other", "Otra"],
				]}
				onChange={(value) => onUpdate(route.id, { type: value as RouteType })}
			/>
			<CaptureTextField
				label="Notas"
				value={route.notes ?? ""}
				onChange={(value) => onUpdate(route.id, { notes: value || null })}
			/>
		</div>
	);
}

function RoutePointMiniEditor({
	onUpdate,
	point,
}: {
	point: RoutePoint;
	onUpdate: (id: string, patch: Partial<RoutePoint>) => void;
}) {
	const isMufa = point.type === "mufa";
	return (
		<div className="space-y-3">
			{isMufa && (
				<div className="grid grid-cols-2 gap-2">
					<CaptureCheckboxField
						checked={point.properties.has_midspan_access === true}
						label="Sangrado"
						onChange={(checked) =>
							onUpdate(point.id, {
								properties: {
									...point.properties,
									has_midspan_access: checked,
								},
							})
						}
					/>
					<CaptureCheckboxField
						checked={point.properties.has_splice === true}
						label="Empalme"
						onChange={(checked) =>
							onUpdate(point.id, {
								properties: { ...point.properties, has_splice: checked },
							})
						}
					/>
				</div>
			)}
			<CaptureTextField
				label="Referencia"
				value={point.reference_text ?? ""}
				onChange={(value) =>
					onUpdate(point.id, { reference_text: value || null })
				}
			/>
			<CaptureTextField
				label="Notas"
				value={point.notes ?? ""}
				onChange={(value) => onUpdate(point.id, { notes: value || null })}
			/>
		</div>
	);
}

function CaptureTextField({
	label,
	onChange,
	value,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
				{label}
			</span>
			<input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#111213] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none focus:border-[#38d8ff]/40"
			/>
		</label>
	);
}

function CaptureNumberField({
	label,
	onChange,
	value,
}: {
	label: string;
	value: number | null;
	onChange: (value: number | null) => void;
}) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
				{label}
			</span>
			<input
				type="number"
				min={0}
				value={value ?? ""}
				onChange={(event) =>
					onChange(
						event.target.value === "" ? null : Number(event.target.value),
					)
				}
				className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#111213] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none focus:border-[#38d8ff]/40"
			/>
		</label>
	);
}

function CaptureSelectField({
	label,
	onChange,
	options,
	value,
}: {
	label: string;
	value: string;
	options: Array<[string, string]>;
	onChange: (value: string) => void;
}) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
				{label}
			</span>
			<select
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#111213] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none focus:border-[#38d8ff]/40"
			>
				{options.map(([optionValue, optionLabel]) => (
					<option key={optionValue} value={optionValue}>
						{optionLabel}
					</option>
				))}
			</select>
		</label>
	);
}

function CaptureCheckboxField({
	checked,
	label,
	onChange,
}: {
	checked: boolean;
	label: string;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="flex items-center gap-2 rounded-md border border-[rgba(164,164,164,0.12)] bg-[#111213] px-2.5 py-2 text-xs text-[#d7d7d7]">
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				className="size-3.5 accent-[#38d8ff]"
			/>
			{label}
		</label>
	);
}
