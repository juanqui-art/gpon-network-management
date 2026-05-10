import Link from "next/link";
import { HealthSummary } from "@/components/monitoring/health-summary";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
	classifySignal,
	type OltMonitorEntry,
	type OntCurrentState,
	type OntHealthSummary,
	type OntStatus,
} from "@/lib/types/gpon";

export const metadata = { title: "Monitoreo de OLTs" };

type MonitoringRow = Pick<
	OntCurrentState,
	| "id"
	| "network_id"
	| "olt_host"
	| "ont_logical_id"
	| "status"
	| "rx_power_dbm"
	| "last_seen_at"
	| "updated_at"
>;

export default async function MonitoringIndexPage() {
	const supabase = await createClient();

	const [{ data: networks }, { data: ontRows }] = await Promise.all([
		supabase.from("networks").select("id, name"),
		supabase
			.from("ont_current_state")
			.select(
				"id, network_id, olt_host, ont_logical_id, status, rx_power_dbm, last_seen_at, updated_at",
			),
	]);

	const networkNameById = new Map<string, string>();
	for (const network of networks ?? []) {
		networkNameById.set(
			(network as { id: string; name: string }).id,
			(network as { id: string; name: string }).name,
		);
	}

	const olts = groupByOlt((ontRows ?? []) as MonitoringRow[], networkNameById);

	return (
		<div className="mx-auto h-full w-full max-w-5xl overflow-auto px-6 py-8">
			<header className="mb-6">
				<h1 className="text-xl font-semibold text-foreground">
					Monitoreo de OLTs
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Salud en tiempo real de cada OLT y sus ONTs. Selecciona una OLT para
					ver el detalle.
				</p>
			</header>

			{olts.length === 0 && (
				<Card className="p-8 text-center">
					<p className="text-sm text-muted-foreground">
						Aún no hay OLTs reportando. Cuando el colector empiece a escribir en{" "}
						<code className="font-mono">ont_current_state</code>, aparecerán
						aquí.
					</p>
				</Card>
			)}

			<div className="grid gap-3">
				{olts.map((entry) => (
					<OltCard key={entry.olt_host} entry={entry} />
				))}
			</div>
		</div>
	);
}

function OltCard({ entry }: { entry: OltMonitorEntry }) {
	const lastUpdate = formatRelative(entry.health.last_update);
	const networkLabel =
		entry.network_names.length === 0
			? "Sin red asociada"
			: entry.network_names.join(" · ");

	return (
		<Link
			href={`/monitoring/olt/${encodeURIComponent(entry.olt_host)}`}
			className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h2 className="truncate font-mono text-sm font-semibold text-foreground">
							OLT {entry.olt_host}
						</h2>
					</div>
					<p className="mt-0.5 truncate text-xs text-muted-foreground">
						{networkLabel}
					</p>
					<div className="mt-3">
						<HealthSummary health={entry.health} compact />
					</div>
				</div>
				<div className="text-right text-xs text-muted-foreground shrink-0">
					{lastUpdate && <p>Última lectura: {lastUpdate}</p>}
					<p className="mt-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
						Ver detalle →
					</p>
				</div>
			</div>
		</Link>
	);
}

function groupByOlt(
	rows: MonitoringRow[],
	networkNameById: Map<string, string>,
): OltMonitorEntry[] {
	const byHost = new Map<string, OltMonitorEntry>();

	for (const row of rows) {
		const entry = byHost.get(row.olt_host) ?? {
			olt_host: row.olt_host,
			network_ids: [],
			network_names: [],
			health: emptyHealth(),
		};

		if (!entry.network_ids.includes(row.network_id)) {
			entry.network_ids.push(row.network_id);
			const name = networkNameById.get(row.network_id);
			if (name) entry.network_names.push(name);
		}

		entry.health.total += 1;
		entry.health[row.status as OntStatus] += 1;
		if (row.status === "online") {
			const signal = classifySignal(row.rx_power_dbm);
			if (signal === "warning" || signal === "critical") {
				entry.health.warning_signal += 1;
			}
		}
		const candidate = row.last_seen_at ?? row.updated_at;
		if (
			candidate &&
			(!entry.health.last_update || candidate > entry.health.last_update)
		) {
			entry.health.last_update = candidate;
		}

		byHost.set(row.olt_host, entry);
	}

	return Array.from(byHost.values()).sort((a, b) =>
		a.olt_host.localeCompare(b.olt_host),
	);
}

function emptyHealth(): OntHealthSummary {
	return {
		total: 0,
		online: 0,
		offline: 0,
		los: 0,
		lof: 0,
		unknown: 0,
		warning_signal: 0,
		last_update: null,
	};
}

function formatRelative(iso: string | null): string | null {
	if (!iso) return null;
	const seen = new Date(iso).getTime();
	if (Number.isNaN(seen)) return null;
	const seconds = Math.floor((Date.now() - seen) / 1000);
	if (seconds < 60) return `hace ${seconds}s`;
	if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
	if (seconds < 86_400) return `hace ${Math.floor(seconds / 3600)} h`;
	return `hace ${Math.floor(seconds / 86_400)} d`;
}
