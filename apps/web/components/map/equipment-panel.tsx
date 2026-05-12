"use client";

import type { ReactNode } from "react";
import { AppDrawer } from "@/components/ui/app-drawer";
import {
	SEVERITY_COLOR,
	SIGNAL_COLOR,
	type SignalClass,
	STATUS_COLOR,
	TYPE_COLOR,
} from "@/lib/map/palette";
import { DataQualityBadge } from "./data-quality-badge";
import { NapCapacity } from "./nap-capacity";
import type { EquipmentMapItem, IncidentMapItem } from "./types";

const TYPE_LABELS: Record<string, string> = {
	olt: "OLT",
	splitter: "Splitter",
	nap: "NAP",
	ont: "ONT",
	amplifier: "Amplificador",
	wdm: "WDM",
};

const STATUS_LABELS: Record<string, string> = {
	online: "En línea",
	offline: "Fuera de línea",
	alarm: "Alarma",
	maintenance: "Mantenimiento",
	decommissioned: "Dado de baja",
	unknown: "Desconocido",
};

const SERVICE_STATUS_LABELS: Record<string, string> = {
	active: "Activo",
	suspended: "Suspendido",
	cancelled: "Cancelado",
	pending_installation: "Pendiente",
};

// ITU-T G.984 Rx thresholds
function classifyRx(dbm: number | null): SignalClass {
	if (dbm === null) return "unknown";
	if (dbm >= -20) return "good";
	if (dbm >= -25) return "warning";
	return "critical";
}

const SIGNAL_LABEL: Record<SignalClass, string> = {
	good: "Buena",
	warning: "Advertencia",
	critical: "Crítica",
	unknown: "Sin datos",
};

// Maps -30 dBm → 0%, -15 dBm → 100%
function rxToPercent(dbm: number): number {
	return Math.min(100, Math.max(0, ((dbm + 30) / 15) * 100));
}

const SEVERITY_LABEL: Record<string, string> = {
	critical: "Crítico",
	high: "Alto",
	medium: "Medio",
	low: "Bajo",
};

const INCIDENT_STATUS_LABEL: Record<string, string> = {
	open: "Abierto",
	in_progress: "En progreso",
	resolved: "Resuelto",
	closed: "Cerrado",
};

interface Props {
	equipment: EquipmentMapItem;
	incident: IncidentMapItem | null;
	onClose: () => void;
}

export function EquipmentPanel({ equipment: eq, incident, onClose }: Props) {
	const statusColor = STATUS_COLOR[eq.status] ?? STATUS_COLOR.unknown;
	const typeColor = TYPE_COLOR[eq.type] ?? STATUS_COLOR.unknown;
	const isOnt = eq.type === "ont";
	const signalClass = isOnt ? classifyRx(eq.rx_power_dbm) : "unknown";

	return (
		<AppDrawer
			open
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose();
			}}
			title={eq.name ?? eq.code ?? "Detalle de equipo"}
			description={`${TYPE_LABELS[eq.type] ?? eq.type} · ${
				STATUS_LABELS[eq.status] ?? eq.status
			}`}
			accent={typeColor}
			size="md"
			className="bg-[rgba(34,35,36,0.92)] text-[#d7d7d7] backdrop-blur-xl"
			contentClassName="space-y-0"
		>
			<div className="space-y-0">
				{/* Status */}
				<Row label="Estado">
					<div className="flex items-center gap-1.5">
						<span
							className="inline-block h-2 w-2 rounded-full"
							style={{ backgroundColor: statusColor }}
						/>
						<span className="text-[#d7d7d7] text-xs">
							{STATUS_LABELS[eq.status] ?? eq.status}
						</span>
					</div>
				</Row>

				{/* Data Quality */}
				<Row label="Calidad">
					<DataQualityBadge quality={eq.location_quality} size="sm" />
				</Row>

				{/* Vendor / Model */}
				{(eq.vendor || eq.model) && (
					<Row label="Equipo">
						<span className="text-[#d7d7d7] text-xs">
							{[eq.vendor, eq.model].filter(Boolean).join(" · ")}
						</span>
					</Row>
				)}

				{/* Type-specific metadata */}
				{eq.type === "olt" && eq.total_pon_ports != null && (
					<Row label="Puertos PON">
						<span className="font-mono text-xs text-[#d7d7d7]">
							{eq.total_pon_ports}
						</span>
					</Row>
				)}

				{eq.type === "splitter" && eq.split_ratio && (
					<Row label="Relación">
						<span className="font-mono text-xs text-[#d7d7d7]">
							{eq.split_ratio}
						</span>
					</Row>
				)}

				{eq.type === "nap" && eq.total_ports != null && (
					<div className="mb-3">
						<NapCapacity element={eq} size="md" />
					</div>
				)}

				{/* ── ONT enriched section ────────────────────────────────────── */}
				{isOnt && (
					<>
						<div className="my-2 h-px bg-[rgba(164,164,164,0.12)]" />

						{/* Signal strength */}
						<div className="py-1.5">
							<div className="mb-1.5 flex items-center justify-between">
								<span className="text-xs text-[#777879]">
									Señal óptica (Rx)
								</span>
								<div className="flex items-center gap-1.5">
									<span
										className="inline-block h-1.5 w-1.5 rounded-full"
										style={{ backgroundColor: SIGNAL_COLOR[signalClass] }}
									/>
									<span
										className="text-xs font-medium"
										style={{ color: SIGNAL_COLOR[signalClass] }}
									>
										{SIGNAL_LABEL[signalClass]}
									</span>
								</div>
							</div>

							{/* dBm bar */}
							<div className="flex items-center gap-2">
								<div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(164,164,164,0.14)]">
									<div
										className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
										style={{
											width:
												eq.rx_power_dbm != null
													? `${rxToPercent(eq.rx_power_dbm)}%`
													: "0%",
											backgroundColor: SIGNAL_COLOR[signalClass],
										}}
									/>
								</div>
								<span className="w-16 text-right font-mono text-[11px] text-[#a4a4a4]">
									{eq.rx_power_dbm != null
										? `${eq.rx_power_dbm.toFixed(1)} dBm`
										: "—"}
								</span>
							</div>

							{eq.tx_power_dbm != null && (
								<p className="mt-1 text-right font-mono text-[10px] text-[#777879]">
									Tx {eq.tx_power_dbm.toFixed(1)} dBm
								</p>
							)}
						</div>

						{/* Service */}
						{eq.service_status && (
							<Row label="Servicio">
								<span className="text-[#d7d7d7] text-xs">
									{SERVICE_STATUS_LABELS[eq.service_status] ??
										eq.service_status}
								</span>
							</Row>
						)}

						{/* Plan */}
						{eq.plan_name && (
							<Row label="Plan">
								<div className="text-right">
									<p className="text-xs text-[#d7d7d7]">{eq.plan_name}</p>
									{eq.download_mbps != null && eq.upload_mbps != null && (
										<p className="font-mono text-[10px] text-[#777879]">
											↓{eq.download_mbps} / ↑{eq.upload_mbps} Mbps
										</p>
									)}
								</div>
							</Row>
						)}

						{/* Customer */}
						{eq.customer_name && (
							<>
								<div className="my-2 h-px bg-[rgba(164,164,164,0.12)]" />
								<div>
									<p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
										Cliente
									</p>
									<p className="text-xs text-[#d7d7d7]">{eq.customer_name}</p>
									{eq.customer_phone && (
										<p className="mt-0.5 font-mono text-[11px] text-[#858585]">
											{eq.customer_phone}
										</p>
									)}
								</div>
							</>
						)}
					</>
				)}

				{/* ── Active incident ─────────────────────────────────────────── */}
				{incident && (
					<>
						<div className="my-2 h-px bg-[rgba(164,164,164,0.12)]" />
						<div
							className="rounded-lg p-2.5"
							style={{
								background: `${SEVERITY_COLOR[incident.severity] ?? SEVERITY_COLOR.low}18`,
								border: `1px solid ${SEVERITY_COLOR[incident.severity] ?? SEVERITY_COLOR.low}33`,
							}}
						>
							<div className="mb-1.5 flex items-center justify-between">
								<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
									Incidente activo
								</p>
								<div className="flex items-center gap-1">
									<span
										className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
										style={{
											background: `${SEVERITY_COLOR[incident.severity] ?? SEVERITY_COLOR.low}33`,
											color:
												SEVERITY_COLOR[incident.severity] ?? SEVERITY_COLOR.low,
										}}
									>
										{SEVERITY_LABEL[incident.severity] ?? incident.severity}
									</span>
								</div>
							</div>
							<p className="text-xs leading-snug text-[#d7d7d7]">
								{incident.title}
							</p>
							<p className="mt-1 text-[10px] text-[#777879]">
								{INCIDENT_STATUS_LABEL[incident.status] ?? incident.status}
							</p>
						</div>
					</>
				)}

				{/* Address */}
				{eq.address && (
					<>
						<div className="my-2 h-px bg-[rgba(164,164,164,0.12)]" />
						<div>
							<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879] mb-1">
								Dirección
							</p>
							<p className="text-xs text-[#a4a4a4] leading-relaxed">
								{eq.address}
							</p>
						</div>
					</>
				)}
			</div>
		</AppDrawer>
	);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-center justify-between py-1.5">
			<span className="text-xs text-[#777879]">{label}</span>
			{children}
		</div>
	);
}
