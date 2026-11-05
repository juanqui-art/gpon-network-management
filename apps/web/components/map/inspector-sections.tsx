import { DataQualityBadge } from "@/components/map/data-quality-badge";
import {
	InspectorRow,
	InspectorSection,
	InspectorText,
} from "@/components/map/map-inspector-primitives";
import type { RoutePoint } from "@/components/map/types";
import {
	CROSSING_TYPE_LABEL,
	labelOf,
	RISK_LEVEL_LABEL,
	ROUTE_POINT_TYPE_LABEL,
	STATUS_LABEL,
} from "@/lib/gpon/labels";
import { formatCoordinates, formatDb, formatMeters } from "@/lib/map/format";
import type { DataQuality } from "@/lib/types/gpon";

/**
 * Feature-level inspector blocks shared by /map (ReadonlyMapViewer) and the
 * editor (NetworkEditorMap). Each screen composes them with its own
 * type-specific sections and actions; the same data always reads the same.
 */

export function LocationSection({
	quality,
	lat,
	lng,
	reference,
	extra,
}: {
	quality: DataQuality;
	lat: number;
	lng: number;
	reference?: string | null;
	extra?: React.ReactNode;
}) {
	return (
		<InspectorSection title="Ubicación">
			<InspectorRow
				label="Calidad"
				value={<DataQualityBadge quality={quality} size="sm" />}
			/>
			<InspectorRow label="Coordenadas" value={formatCoordinates(lat, lng)} />
			{extra}
			{reference && <InspectorText label="Referencia" value={reference} />}
		</InspectorSection>
	);
}

export function NotesSection({ notes }: { notes: string | null | undefined }) {
	if (!notes) return null;
	return (
		<InspectorSection title="Notas">
			<InspectorText label="Observaciones" value={notes} />
		</InspectorSection>
	);
}

const MAX_PROPERTIES = 8;

/** Free-form `properties` JSON, humanized. Hidden when empty. */
export function PropertiesSection({
	properties,
	omit = [],
}: {
	properties: Record<string, unknown> | null | undefined;
	/** Keys already rendered by a dedicated row. */
	omit?: string[];
}) {
	const entries = Object.entries(properties ?? {}).filter(
		([key, value]) =>
			!omit.includes(key) &&
			value !== null &&
			value !== undefined &&
			value !== "",
	);
	if (entries.length === 0) return null;

	return (
		<InspectorSection title="Propiedades">
			{entries.slice(0, MAX_PROPERTIES).map(([key, value]) => (
				<InspectorRow
					key={key}
					label={formatPropertyKey(key)}
					value={formatPropertyValue(value)}
				/>
			))}
			{entries.length > MAX_PROPERTIES && (
				<p className="text-right text-[11px] text-fg-muted">
					+{entries.length - MAX_PROPERTIES} propiedades más
				</p>
			)}
		</InspectorSection>
	);
}

const MUFA_FLAGS = [
	"has_midspan_access",
	"has_splice",
	"has_splitter",
	"split_ratio",
];

export function describeMufaProperties(properties: Record<string, unknown>) {
	const details = [];
	if (properties.has_midspan_access === true) details.push("sangrado");
	if (properties.has_splice === true) details.push("empalme");
	if (properties.has_splitter === true) {
		details.push(
			properties.split_ratio
				? `splitter ${String(properties.split_ratio)}`
				: "splitter",
		);
	}
	return details.length > 0 ? `Mufa + ${details.join(" + ")}` : "Mufa simple";
}

/** Route point (crossing / reserve / splice / mufa): same view on every screen. */
export function RoutePointSummary({
	point,
	routeCode,
}: {
	point: RoutePoint;
	/** Code of the parent route, when the caller can resolve it. */
	routeCode?: string | null;
}) {
	const isMufa = point.type === "mufa";
	return (
		<div className="space-y-3">
			<InspectorSection title="Identificación">
				<InspectorRow
					label="Tipo"
					value={labelOf(ROUTE_POINT_TYPE_LABEL, point.type)}
				/>
				{isMufa && (
					<InspectorRow
						label="Configuración"
						value={describeMufaProperties(point.properties ?? {})}
					/>
				)}
				<InspectorRow label="Código" value={point.code ?? "Sin código"} />
				<InspectorRow
					label="Estado"
					value={labelOf(STATUS_LABEL, point.status, "Sin estado")}
				/>
				{routeCode !== undefined && (
					<InspectorRow label="Ruta" value={routeCode ?? "Ruta sin código"} />
				)}
			</InspectorSection>

			<InspectorSection title="En la ruta">
				<InspectorRow
					label="Posición"
					value={formatMeters(point.position_on_route_m, 1)}
				/>
				<InspectorRow
					label="Reserva"
					value={formatMeters(point.reserve_length_m)}
				/>
				<InspectorRow
					label="Pérdida de empalme"
					value={formatDb(point.splice_loss_db)}
				/>
				{point.crossing_type && (
					<InspectorRow
						label="Cruce"
						value={labelOf(CROSSING_TYPE_LABEL, point.crossing_type)}
					/>
				)}
				{point.risk_level && (
					<InspectorRow
						label="Riesgo"
						value={labelOf(RISK_LEVEL_LABEL, point.risk_level)}
					/>
				)}
			</InspectorSection>

			<LocationSection
				quality={point.location_quality}
				lat={point.lat}
				lng={point.lng}
				reference={point.reference_text}
			/>
			<PropertiesSection
				properties={point.properties}
				omit={isMufa ? MUFA_FLAGS : []}
			/>
			<NotesSection notes={point.notes} />
		</div>
	);
}

function formatPropertyKey(key: string) {
	return key.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());
}

function formatPropertyValue(value: unknown): string {
	if (typeof value === "boolean") return value ? "Sí" : "No";
	if (typeof value === "number")
		return Number.isFinite(value) ? String(value) : "—";
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(formatPropertyValue).join(", ");
	if (typeof value === "object" && value !== null) return JSON.stringify(value);
	return String(value);
}
