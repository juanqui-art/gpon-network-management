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

interface OltElementRow {
	id: string;
	code: string;
	name: string | null;
	management_ip: string;
	total_pon_ports: number | null;
	properties: Record<string, unknown>;
}

export default async function MonitoringIndexPage() {
	const supabase = await createClient();

	const [{ data: networks }, { data: ontRows }, { data: oltElements }] =
		await Promise.all([
			supabase.from("networks").select("id, name"),
			supabase
				.from("ont_current_state")
				.select(
					"id, network_id, olt_host, ont_logical_id, status, rx_power_dbm, last_seen_at, updated_at",
				),
			// OLTs con management_ip configurado — para resolver nombre humano por host
			supabase
				.from("infrastructure_elements")
				.select("id, code, name, management_ip, total_pon_ports, properties")
				.eq("type", "olt")
				.not("management_ip", "is", null),
		]);

	const networkNameById = new Map<string, string>();
	for (const network of networks ?? []) {
		networkNameById.set(
			(network as { id: string; name: string }).id,
			(network as { id: string; name: string }).name,
		);
	}

	const oltElementByHost = new Map<string, OltElementRow>();
	for (const row of (oltElements ?? []) as OltElementRow[]) {
		oltElementByHost.set(row.management_ip, row);
	}

	const olts = groupByOlt(
		(ontRows ?? []) as MonitoringRow[],
		networkNameById,
		oltElementByHost,
	);

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

	const title =
		entry.element_name ?? entry.element_code ?? `OLT ${entry.olt_host}`;

	const techParts = [
		entry.element_model,
		entry.element_total_pon_ports !== null
			? `${entry.element_total_pon_ports} PON`
			: null,
	].filter(Boolean);

	return (
		<Link
			href={`/monitoring/olt/${encodeURIComponent(entry.olt_host)}`}
			className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h2 className="truncate text-sm font-semibold text-foreground">
							{title}
						</h2>
						{!entry.element_id && (
							<span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
								sin equipo asociado
							</span>
						)}
					</div>
					{techParts.length > 0 && (
						<p className="mt-0.5 truncate text-xs text-muted-foreground">
							{techParts.join(" · ")}
						</p>
					)}
					<p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
						{entry.olt_host} · {networkLabel}
					</p>
					<div className="mt-3">
						<HealthSummary health={entry.health} compact />
					</div>
				</div>
				<div className="shrink-0 text-right text-xs text-muted-foreground">
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
	oltElementByHost: Map<string, OltElementRow>,
): OltMonitorEntry[] {
	const byHost = new Map<string, OltMonitorEntry>();

	for (const row of rows) {
		const entry =
			byHost.get(row.olt_host) ?? createEmpty(row.olt_host, oltElementByHost);

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

function createEmpty(
	host: string,
	oltElementByHost: Map<string, OltElementRow>,
): OltMonitorEntry {
	const matched = oltElementByHost.get(host);
	const model =
		typeof matched?.properties?.olt_model === "string"
			? (matched.properties.olt_model as string)
			: null;
	return {
		olt_host: host,
		element_id: matched?.id ?? null,
		element_code: matched?.code ?? null,
		element_name: matched?.name ?? null,
		element_model: model,
		element_total_pon_ports: matched?.total_pon_ports ?? null,
		network_ids: [],
		network_names: [],
		health: emptyHealth(),
	};
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
