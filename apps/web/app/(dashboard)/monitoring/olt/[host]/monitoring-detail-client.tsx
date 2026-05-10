"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HealthSummary } from "@/components/monitoring/health-summary";
import { OltInfoCard } from "@/components/monitoring/olt-info-card";
import { OntStatusBadge } from "@/components/monitoring/ont-status-badge";
import { RxPowerCell } from "@/components/monitoring/rx-power-cell";
import { Input } from "@/components/ui/input";
import { useOntRealtime } from "@/lib/hooks/use-ont-realtime";
import {
	classifySignal,
	type OntCurrentState,
	type OntHealthSummary,
	type OntStatus,
} from "@/lib/types/gpon";
import { cn } from "@/lib/utils";
import type { OltElementInfo } from "./page";

interface Props {
	oltHost: string;
	elementInfo: OltElementInfo | null;
	networkNames: string[];
	initialReadings: OntCurrentState[];
}

type StatusFilter = "all" | "online" | "offline" | "alerts";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: "all", label: "Todos" },
	{ value: "online", label: "Online" },
	{ value: "offline", label: "Offline" },
	{ value: "alerts", label: "Alertas señal" },
];

export function MonitoringDetailClient({
	oltHost,
	elementInfo,
	networkNames,
	initialReadings,
}: Props) {
	const elementCode = elementInfo?.code ?? null;
	const elementName = elementInfo?.name ?? null;
	const { readings, connected, lastEventAt } = useOntRealtime({
		oltHost,
		initialReadings,
	});

	const [filter, setFilter] = useState<StatusFilter>("all");
	const [search, setSearch] = useState("");

	const health = useMemo(() => buildHealth(readings), [readings]);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		return readings.filter((r) => {
			if (!matchesFilter(r, filter)) return false;
			if (!term) return true;
			return (
				r.ont_logical_id.toLowerCase().includes(term) ||
				(r.ont_description?.toLowerCase().includes(term) ?? false) ||
				(r.ont_serial?.toLowerCase().includes(term) ?? false)
			);
		});
	}, [readings, filter, search]);

	const networkLabel =
		networkNames.length === 0 ? "Sin red asociada" : networkNames.join(" · ");
	const title = elementName ?? elementCode ?? `OLT ${oltHost}`;
	const subtitleParts = [
		elementCode || elementName ? oltHost : null,
		networkLabel,
	].filter(Boolean);

	return (
		<div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden px-6 py-6">
			<header className="mb-4 shrink-0">
				<Link
					href="/monitoring"
					className="text-xs text-muted-foreground hover:text-foreground"
				>
					← Volver a OLTs
				</Link>
				<div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
					<div>
						<h1 className="text-xl font-semibold text-foreground">{title}</h1>
						<p className="mt-0.5 font-mono text-xs text-muted-foreground">
							{subtitleParts.join(" · ")}
						</p>
					</div>
					<RealtimeIndicator
						connected={connected}
						lastEventAt={lastEventAt}
						initialCount={initialReadings.length}
					/>
				</div>
				<div className="mt-3">
					<HealthSummary health={health} />
				</div>
			</header>

			{elementInfo && (
				<div className="mb-3 shrink-0">
					<OltInfoCard
						host={oltHost}
						code={elementInfo.code}
						status={elementInfo.status}
						opticalClass={elementInfo.optical_class}
						totalPonPorts={elementInfo.total_pon_ports}
						properties={elementInfo.properties}
					/>
				</div>
			)}

			<div className="mb-3 flex flex-wrap items-center gap-2 shrink-0">
				<div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
					{STATUS_FILTERS.map((option) => (
						<button
							key={option.value}
							type="button"
							onClick={() => setFilter(option.value)}
							className={cn(
								"rounded px-2.5 py-1 text-xs transition-colors",
								filter === option.value
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
							)}
						>
							{option.label}
						</button>
					))}
				</div>
				<Input
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="Buscar por ID, cliente o serial…"
					className="h-8 max-w-xs text-xs"
				/>
			</div>

			<div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card">
				<OntTable readings={filtered} totalCount={readings.length} />
			</div>
		</div>
	);
}

function OntTable({
	readings,
	totalCount,
}: {
	readings: OntCurrentState[];
	totalCount: number;
}) {
	if (totalCount === 0) {
		return (
			<div className="p-12 text-center text-sm text-muted-foreground">
				Esta OLT aún no tiene telemetría reportada. Cuando el colector empiece a
				escribir en <code className="font-mono">ont_current_state</code> con
				este <code className="font-mono">olt_host</code>, aparecerán las ONTs
				aquí.
			</div>
		);
	}

	if (readings.length === 0) {
		return (
			<div className="p-12 text-center text-sm text-muted-foreground">
				Ningún resultado coincide con el filtro actual.
			</div>
		);
	}

	return (
		<table className="w-full text-sm">
			<thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground">
				<tr className="border-b border-border">
					<Th>Logical ID</Th>
					<Th>Cliente</Th>
					<Th>Serial</Th>
					<Th>Status</Th>
					<Th align="right">RX Power</Th>
					<Th align="right">TX Power</Th>
					<Th align="right">Distancia</Th>
					<Th align="right">Temp</Th>
					<Th>Última lectura</Th>
				</tr>
			</thead>
			<tbody>
				{readings.map((reading) => (
					<OntRow key={reading.ont_logical_id} reading={reading} />
				))}
			</tbody>
		</table>
	);
}

function OntRow({ reading }: { reading: OntCurrentState }) {
	const signal = classifySignal(reading.rx_power_dbm);
	const isAlert =
		reading.status === "online" &&
		(signal === "warning" || signal === "critical");

	return (
		<tr
			className={cn(
				"border-b border-border/50 last:border-0 hover:bg-muted/30",
				isAlert && "bg-amber-500/5",
			)}
		>
			<Td className="font-mono text-xs">{reading.ont_logical_id}</Td>
			<Td className="text-xs">{reading.ont_description ?? "—"}</Td>
			<Td className="font-mono text-xs">{reading.ont_serial ?? "—"}</Td>
			<Td>
				<OntStatusBadge status={reading.status} />
			</Td>
			<Td align="right">
				<RxPowerCell rxPowerDbm={reading.rx_power_dbm} />
			</Td>
			<Td align="right" className="font-mono text-xs tabular-nums">
				{reading.tx_power_dbm !== null
					? `${reading.tx_power_dbm.toFixed(2)} dBm`
					: "—"}
			</Td>
			<Td align="right" className="font-mono text-xs tabular-nums">
				{reading.distance_m !== null ? `${reading.distance_m} m` : "—"}
			</Td>
			<Td align="right" className="font-mono text-xs tabular-nums">
				{reading.temperature_c !== null
					? `${reading.temperature_c.toFixed(1)} °C`
					: "—"}
			</Td>
			<Td className="text-xs text-muted-foreground">
				{formatRelative(reading.last_seen_at ?? reading.updated_at)}
			</Td>
		</tr>
	);
}

function Th({
	children,
	align = "left",
}: {
	children: React.ReactNode;
	align?: "left" | "right";
}) {
	return (
		<th
			className={cn(
				"px-3 py-2 font-medium",
				align === "right" ? "text-right" : "text-left",
			)}
		>
			{children}
		</th>
	);
}

function Td({
	children,
	align = "left",
	className,
}: {
	children: React.ReactNode;
	align?: "left" | "right";
	className?: string;
}) {
	return (
		<td
			className={cn(
				"px-3 py-2",
				align === "right" ? "text-right" : "text-left",
				className,
			)}
		>
			{children}
		</td>
	);
}

function RealtimeIndicator({
	connected,
	lastEventAt,
	initialCount,
}: {
	connected: boolean;
	lastEventAt: Date | null;
	initialCount: number;
}) {
	const [, force] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => force((n) => n + 1), 5000);
		return () => clearInterval(interval);
	}, []);

	const lastText = lastEventAt
		? formatRelative(lastEventAt.toISOString())
		: initialCount > 0
			? "esperando primer evento"
			: "sin datos";

	return (
		<div className="flex items-center gap-2 text-xs text-muted-foreground">
			<span
				className={cn(
					"h-2 w-2 rounded-full",
					connected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40",
				)}
				aria-hidden
			/>
			<span>
				{connected ? "Realtime activo" : "Conectando…"} · {lastText}
			</span>
		</div>
	);
}

function buildHealth(readings: OntCurrentState[]): OntHealthSummary {
	const health: OntHealthSummary = {
		total: readings.length,
		online: 0,
		offline: 0,
		los: 0,
		lof: 0,
		unknown: 0,
		warning_signal: 0,
		last_update: null,
	};

	for (const r of readings) {
		health[r.status as OntStatus] += 1;
		if (r.status === "online") {
			const signal = classifySignal(r.rx_power_dbm);
			if (signal === "warning" || signal === "critical") {
				health.warning_signal += 1;
			}
		}
		const candidate = r.last_seen_at ?? r.updated_at;
		if (candidate && (!health.last_update || candidate > health.last_update)) {
			health.last_update = candidate;
		}
	}

	return health;
}

function matchesFilter(
	reading: OntCurrentState,
	filter: StatusFilter,
): boolean {
	if (filter === "all") return true;
	if (filter === "online") return reading.status === "online";
	if (filter === "offline") {
		return (
			reading.status === "offline" ||
			reading.status === "los" ||
			reading.status === "lof"
		);
	}
	if (filter === "alerts") {
		if (reading.status !== "online") return false;
		const signal = classifySignal(reading.rx_power_dbm);
		return signal === "warning" || signal === "critical";
	}
	return true;
}

function formatRelative(iso: string | null): string {
	if (!iso) return "—";
	const target = new Date(iso).getTime();
	if (Number.isNaN(target)) return "—";
	const seconds = Math.floor((Date.now() - target) / 1000);
	if (seconds < 5) return "ahora";
	if (seconds < 60) return `hace ${seconds}s`;
	if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
	if (seconds < 86_400) return `hace ${Math.floor(seconds / 3600)} h`;
	return `hace ${Math.floor(seconds / 86_400)} d`;
}
