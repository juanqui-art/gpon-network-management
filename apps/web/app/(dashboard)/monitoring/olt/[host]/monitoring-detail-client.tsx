"use client";

import {
	Activity,
	AlertTriangle,
	ChevronDown,
	EthernetPort,
	type LucideIcon,
	Search,
	Server,
} from "lucide-react";
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

interface PonGroup {
	key: string;
	label: string;
	readings: OntCurrentState[];
	health: OntHealthSummary;
	averageRx: number | null;
	worstRx: number | null;
	lastUpdate: string | null;
}

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
	const [expandedPonKeys, setExpandedPonKeys] = useState<Set<string>>(
		() => new Set(),
	);
	const [nowMs, setNowMs] = useState<number | null>(null);

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
	const ponGroups = useMemo(() => buildPonGroups(filtered), [filtered]);
	const totalPonGroups = useMemo(() => buildPonGroups(readings), [readings]);

	useEffect(() => {
		if (totalPonGroups.length === 0) return;
		setExpandedPonKeys((current) => {
			if (current.size > 0) return current;
			const firstAttention =
				totalPonGroups.find((group) => needsAttention(group.health)) ??
				totalPonGroups[0];
			return new Set([firstAttention.key]);
		});
	}, [totalPonGroups]);

	useEffect(() => {
		setNowMs(Date.now());
		const interval = setInterval(() => setNowMs(Date.now()), 5000);
		return () => clearInterval(interval);
	}, []);

	const networkLabel =
		networkNames.length === 0 ? "Sin red asociada" : networkNames.join(" · ");
	const title = elementName ?? elementCode ?? `OLT ${oltHost}`;
	const subtitleParts = [
		elementCode || elementName ? oltHost : null,
		networkLabel,
	].filter(Boolean);
	const activePonCount = totalPonGroups.filter(
		(group) => group.health.total > 0,
	).length;
	const totalPonPorts = elementInfo?.total_pon_ports ?? null;

	return (
		<div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden px-5 py-5 lg:px-6">
			<header className="mb-4 shrink-0 rounded-lg border border-border bg-card">
				<div className="border-b border-border px-4 py-3">
					<Link
						href="/monitoring"
						className="text-xs text-muted-foreground hover:text-foreground"
					>
						← Volver a OLTs
					</Link>
					<div className="mt-3 flex flex-wrap items-start justify-between gap-4">
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
									<Server className="size-4" aria-hidden />
								</span>
								<div className="min-w-0">
									<h1 className="truncate text-xl font-semibold text-foreground">
										{title}
									</h1>
									<p className="mt-0.5 font-mono text-xs text-muted-foreground">
										{subtitleParts.join(" · ")}
									</p>
								</div>
							</div>
						</div>
						<RealtimeIndicator
							connected={connected}
							lastEventAt={lastEventAt}
							initialCount={initialReadings.length}
							nowMs={nowMs}
						/>
					</div>
				</div>
				<div className="grid gap-3 px-4 py-3 lg:grid-cols-[1.3fr_1fr_1fr]">
					<div className="rounded-md border border-border/70 bg-background/50 px-3 py-2">
						<p className="text-[11px] font-medium uppercase text-muted-foreground">
							Salud general
						</p>
						<div className="mt-2">
							<HealthSummary health={health} />
						</div>
					</div>
					<MetricTile
						icon={EthernetPort}
						label="Puertos PON activos"
						value={
							totalPonPorts !== null
								? `${activePonCount} / ${totalPonPorts}`
								: String(activePonCount)
						}
						detail={`${readings.length} ONTs monitoreadas`}
					/>
					<MetricTile
						icon={Activity}
						label="Atención óptica"
						value={String(health.warning_signal + health.los + health.lof)}
						detail="alertas de señal, LOS o LOF"
						tone={
							health.warning_signal + health.los + health.lof > 0
								? "warning"
								: "good"
						}
					/>
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

			<div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
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
				<div className="relative min-w-0 flex-[1_1_18rem] sm:max-w-sm">
					<Search
						className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
						aria-hidden
					/>
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar por ID, cliente o serial…"
						className="h-8 pl-8 text-xs"
					/>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card">
				<PonTree
					groups={ponGroups}
					totalCount={readings.length}
					filteredCount={filtered.length}
					expandedKeys={expandedPonKeys}
					nowMs={nowMs}
					onToggle={(key) =>
						setExpandedPonKeys((current) => {
							const next = new Set(current);
							if (next.has(key)) next.delete(key);
							else next.add(key);
							return next;
						})
					}
					onExpandAll={() =>
						setExpandedPonKeys(new Set(ponGroups.map((group) => group.key)))
					}
					onCollapseAll={() => setExpandedPonKeys(new Set())}
				/>
			</div>
		</div>
	);
}

function MetricTile({
	icon: Icon,
	label,
	value,
	detail,
	tone = "neutral",
}: {
	icon: LucideIcon;
	label: string;
	value: string;
	detail: string;
	tone?: "neutral" | "good" | "warning";
}) {
	return (
		<div className="flex items-center gap-3 rounded-md border border-border/70 bg-background/50 px-3 py-2">
			<span
				className={cn(
					"flex size-8 shrink-0 items-center justify-center rounded-md",
					tone === "good" &&
						"bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
					tone === "warning" &&
						"bg-amber-500/10 text-amber-600 dark:text-amber-400",
					tone === "neutral" && "bg-muted text-muted-foreground",
				)}
			>
				<Icon className="size-4" aria-hidden />
			</span>
			<div className="min-w-0">
				<p className="text-[11px] font-medium uppercase text-muted-foreground">
					{label}
				</p>
				<p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
					{value}
				</p>
				<p className="truncate text-xs text-muted-foreground">{detail}</p>
			</div>
		</div>
	);
}

function PonTree({
	groups,
	totalCount,
	filteredCount,
	expandedKeys,
	nowMs,
	onToggle,
	onExpandAll,
	onCollapseAll,
}: {
	groups: PonGroup[];
	totalCount: number;
	filteredCount: number;
	expandedKeys: Set<string>;
	nowMs: number | null;
	onToggle: (key: string) => void;
	onExpandAll: () => void;
	onCollapseAll: () => void;
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

	if (filteredCount === 0) {
		return (
			<div className="p-12 text-center text-sm text-muted-foreground">
				Ningún resultado coincide con el filtro actual.
			</div>
		);
	}

	return (
		<div>
			<div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2 text-xs text-muted-foreground">
				<span>
					{groups.length} {groups.length === 1 ? "puerto" : "puertos"} PON ·{" "}
					{filteredCount} de {totalCount} ONTs
				</span>
				<div className="flex items-center gap-2">
					<span className="hidden sm:inline">OLT → PON → cliente/ONT</span>
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={onExpandAll}
							className="rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							Expandir
						</button>
						<button
							type="button"
							onClick={onCollapseAll}
							className="rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							Contraer
						</button>
					</div>
				</div>
			</div>
			<div className="divide-y divide-border">
				{groups.map((group) => (
					<PonGroupSection
						key={group.key}
						group={group}
						expanded={expandedKeys.has(group.key)}
						nowMs={nowMs}
						onToggle={() => onToggle(group.key)}
					/>
				))}
			</div>
		</div>
	);
}

function PonGroupSection({
	group,
	expanded,
	nowMs,
	onToggle,
}: {
	group: PonGroup;
	expanded: boolean;
	nowMs: number | null;
	onToggle: () => void;
}) {
	const offlineLike =
		group.health.offline + group.health.los + group.health.lof;
	const attentionCount = offlineLike + group.health.warning_signal;

	return (
		<section>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={expanded}
				className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
			>
				<span
					className={cn(
						"flex size-8 shrink-0 items-center justify-center rounded-md border",
						attentionCount > 0
							? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
							: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
					)}
				>
					<EthernetPort className="size-4" aria-hidden />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<h2 className="font-mono text-sm font-semibold text-foreground">
							PON {group.label}
						</h2>
						<HealthSummary health={group.health} compact />
					</div>
					<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
						<span>RX promedio: {formatDbm(group.averageRx)}</span>
						<span>Peor RX: {formatDbm(group.worstRx)}</span>
						{group.lastUpdate && (
							<span>
								Última lectura: {formatRelative(group.lastUpdate, nowMs)}
							</span>
						)}
					</div>
				</div>
				{attentionCount > 0 && (
					<span className="hidden items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300 sm:inline-flex">
						<AlertTriangle className="size-3.5" aria-hidden />
						{attentionCount} requieren atención
					</span>
				)}
				<ChevronDown
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform",
						expanded && "rotate-180",
					)}
					aria-hidden
				/>
			</button>
			{expanded && (
				<div className="border-t border-border/70 bg-background/35">
					<OntTable readings={group.readings} nowMs={nowMs} />
				</div>
			)}
		</section>
	);
}

function OntTable({
	readings,
	nowMs,
}: {
	readings: OntCurrentState[];
	nowMs: number | null;
}) {
	return (
		<>
			{/* Mobile: stacked cards */}
			<div className="flex flex-col gap-2 p-3 md:hidden">
				{readings.map((reading) => (
					<OntCard key={reading.id} reading={reading} nowMs={nowMs} />
				))}
			</div>
			{/* Desktop: scrollable table */}
			<div className="hidden overflow-x-auto md:block">
				<table className="w-full min-w-[980px] table-fixed text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr className="border-b border-border">
							<Th className="w-[150px]">Logical ID</Th>
							<Th className="w-[260px]">Cliente</Th>
							<Th className="w-[140px]">Serial</Th>
							<Th className="w-[130px]">Status</Th>
							<Th align="right" className="w-[130px]">
								RX Power
							</Th>
							<Th align="right" className="w-[120px]">
								TX Power
							</Th>
							<Th align="right" className="w-[110px]">
								Distancia
							</Th>
							<Th align="right" className="w-[90px]">
								Temp
							</Th>
							<Th className="w-[130px]">Última lectura</Th>
						</tr>
					</thead>
					<tbody>
						{readings.map((reading) => (
							<OntRow key={reading.id} reading={reading} nowMs={nowMs} />
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}

function OntCard({
	reading,
	nowMs,
}: {
	reading: OntCurrentState;
	nowMs: number | null;
}) {
	const signal = classifySignal(reading.rx_power_dbm);
	const isAlert =
		reading.status === "online" &&
		(signal === "warning" || signal === "critical");

	return (
		<div
			className={cn(
				"space-y-2 rounded-md border border-border bg-background/40 p-3",
				isAlert && "border-amber-500/30 bg-amber-500/5",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<p className="truncate font-mono text-xs font-semibold text-foreground">
						{reading.ont_logical_id}
					</p>
					{reading.ont_description && (
						<p className="mt-0.5 truncate text-xs text-muted-foreground">
							{reading.ont_description}
						</p>
					)}
				</div>
				<OntStatusBadge status={reading.status} />
			</div>

			<div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
				<div>
					<p className="text-[10px] uppercase text-muted-foreground">
						RX Power
					</p>
					<RxPowerCell rxPowerDbm={reading.rx_power_dbm} />
				</div>
				<div>
					<p className="text-[10px] uppercase text-muted-foreground">
						TX Power
					</p>
					<p className="font-mono tabular-nums text-foreground">
						{reading.tx_power_dbm !== null
							? `${reading.tx_power_dbm.toFixed(2)} dBm`
							: "—"}
					</p>
				</div>
				<div>
					<p className="text-[10px] uppercase text-muted-foreground">
						Distancia
					</p>
					<p className="font-mono tabular-nums text-foreground">
						{reading.distance_m !== null ? `${reading.distance_m} m` : "—"}
					</p>
				</div>
				<div>
					<p className="text-[10px] uppercase text-muted-foreground">Temp</p>
					<p className="font-mono tabular-nums text-foreground">
						{reading.temperature_c !== null
							? `${reading.temperature_c.toFixed(1)} °C`
							: "—"}
					</p>
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-1.5 text-[11px] text-muted-foreground">
				<span className="font-mono">{reading.ont_serial ?? "Sin serial"}</span>
				<span>
					{formatRelative(reading.last_seen_at ?? reading.updated_at, nowMs)}
				</span>
			</div>
		</div>
	);
}

function OntRow({
	reading,
	nowMs,
}: {
	reading: OntCurrentState;
	nowMs: number | null;
}) {
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
			<Td className="truncate font-mono text-xs">{reading.ont_logical_id}</Td>
			<Td
				className="truncate text-xs"
				title={reading.ont_description ?? undefined}
			>
				{reading.ont_description ?? "—"}
			</Td>
			<Td className="truncate font-mono text-xs">
				{reading.ont_serial ?? "—"}
			</Td>
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
				{formatRelative(reading.last_seen_at ?? reading.updated_at, nowMs)}
			</Td>
		</tr>
	);
}

function Th({
	children,
	align = "left",
	className,
}: {
	children: React.ReactNode;
	align?: "left" | "right";
	className?: string;
}) {
	return (
		<th
			className={cn(
				"px-3 py-2 font-medium",
				align === "right" ? "text-right" : "text-left",
				className,
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
	title,
}: {
	children: React.ReactNode;
	align?: "left" | "right";
	className?: string;
	title?: string;
}) {
	return (
		<td
			title={title}
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
	nowMs,
}: {
	connected: boolean;
	lastEventAt: Date | null;
	initialCount: number;
	nowMs: number | null;
}) {
	const lastText = lastEventAt
		? formatRelative(lastEventAt.toISOString(), nowMs)
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

function buildPonGroups(readings: OntCurrentState[]): PonGroup[] {
	const byPon = new Map<string, OntCurrentState[]>();

	for (const reading of readings) {
		const key = reading.pon_port?.trim() || "unknown";
		const group = byPon.get(key) ?? [];
		group.push(reading);
		byPon.set(key, group);
	}

	return Array.from(byPon.entries())
		.map(([key, groupReadings]) => {
			const sortedReadings = [...groupReadings].sort(sortByLogicalId);
			const rxValues = sortedReadings
				.map((reading) => reading.rx_power_dbm)
				.filter((value): value is number => value !== null);
			const lastUpdate = sortedReadings.reduce<string | null>(
				(latest, reading) => {
					const candidate = reading.last_seen_at ?? reading.updated_at;
					if (!candidate) return latest;
					if (!latest || candidate > latest) return candidate;
					return latest;
				},
				null,
			);

			return {
				key,
				label: key === "unknown" ? "sin puerto" : key,
				readings: sortedReadings,
				health: buildHealth(sortedReadings),
				averageRx:
					rxValues.length > 0
						? rxValues.reduce((sum, value) => sum + value, 0) / rxValues.length
						: null,
				worstRx: rxValues.length > 0 ? Math.min(...rxValues) : null,
				lastUpdate,
			};
		})
		.sort((a, b) => sortPonLabel(a.label, b.label));
}

function sortByLogicalId(a: OntCurrentState, b: OntCurrentState): number {
	return a.ont_logical_id.localeCompare(b.ont_logical_id, undefined, {
		numeric: true,
	});
}

function sortPonLabel(a: string, b: string): number {
	if (a === "sin puerto") return 1;
	if (b === "sin puerto") return -1;
	return a.localeCompare(b, undefined, { numeric: true });
}

function needsAttention(health: OntHealthSummary): boolean {
	return health.warning_signal + health.offline + health.los + health.lof > 0;
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

function formatDbm(value: number | null): string {
	return value === null ? "—" : `${value.toFixed(2)} dBm`;
}

function formatRelative(iso: string | null, nowMs: number | null): string {
	if (!iso) return "—";
	if (nowMs === null) return "—";
	const target = new Date(iso).getTime();
	if (Number.isNaN(target)) return "—";
	const seconds = Math.floor((nowMs - target) / 1000);
	if (seconds < 5) return "ahora";
	if (seconds < 60) return `hace ${seconds}s`;
	if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
	if (seconds < 86_400) return `hace ${Math.floor(seconds / 3600)} h`;
	return `hace ${Math.floor(seconds / 86_400)} d`;
}
