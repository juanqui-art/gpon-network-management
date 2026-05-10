import Link from "next/link";
import { NetworkHealthSummary } from "@/components/monitoring/network-health-summary";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
	classifySignal,
	type NetworkOntHealth,
	type OntCurrentState,
	type OntStatus,
} from "@/lib/types/gpon";
import type { NetworkSummary } from "@/lib/types/network";

export const metadata = { title: "Monitoreo — Redes GPON" };

interface MonitoredNetwork extends NetworkSummary {
	health: NetworkOntHealth;
}

export default async function MonitoringIndexPage() {
	const supabase = await createClient();

	const [{ data: networks }, { data: ontRows }] = await Promise.all([
		supabase.rpc("list_networks"),
		supabase
			.from("ont_current_state")
			.select(
				"id, network_id, ont_logical_id, status, rx_power_dbm, last_seen_at, updated_at",
			),
	]);

	const monitored = buildMonitored(
		(networks ?? []) as NetworkSummary[],
		(ontRows ?? []) as Pick<
			OntCurrentState,
			| "network_id"
			| "status"
			| "rx_power_dbm"
			| "last_seen_at"
			| "updated_at"
			| "ont_logical_id"
			| "id"
		>[],
	);

	return (
		<div className="mx-auto h-full w-full max-w-5xl overflow-auto px-6 py-8">
			<header className="mb-6">
				<h1 className="text-xl font-semibold text-foreground">
					Monitoreo de redes
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Salud en tiempo real de las ONTs por red. Selecciona una red para ver
					detalle.
				</p>
			</header>

			{monitored.length === 0 && (
				<Card className="p-8 text-center">
					<p className="text-sm text-muted-foreground">
						No hay redes para monitorear.
					</p>
				</Card>
			)}

			<div className="grid gap-3">
				{monitored.map((network) => (
					<NetworkCard key={network.id} network={network} />
				))}
			</div>
		</div>
	);
}

function NetworkCard({ network }: { network: MonitoredNetwork }) {
	const { health } = network;
	const lastUpdate = formatLastUpdate(health.last_update);
	const noData = health.total === 0;

	return (
		<Link
			href={`/monitoring/${network.id}`}
			className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-sm font-semibold text-foreground">
						{network.name}
					</h2>
					{network.description && (
						<p className="mt-0.5 truncate text-xs text-muted-foreground">
							{network.description}
						</p>
					)}
					<div className="mt-3">
						{noData ? (
							<p className="text-xs text-muted-foreground">
								Sin telemetría reportada todavía
							</p>
						) : (
							<NetworkHealthSummary health={health} compact />
						)}
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

function buildMonitored(
	networks: NetworkSummary[],
	rows: Pick<
		OntCurrentState,
		| "network_id"
		| "status"
		| "rx_power_dbm"
		| "last_seen_at"
		| "updated_at"
		| "ont_logical_id"
		| "id"
	>[],
): MonitoredNetwork[] {
	const healthByNetwork = new Map<string, NetworkOntHealth>();

	for (const row of rows) {
		const current =
			healthByNetwork.get(row.network_id) ?? emptyHealth(row.network_id);
		current.total += 1;
		current[row.status as OntStatus] += 1;
		if (row.status === "online") {
			const signal = classifySignal(row.rx_power_dbm);
			if (signal === "warning" || signal === "critical") {
				current.warning_signal += 1;
			}
		}
		const candidate = row.last_seen_at ?? row.updated_at;
		if (
			candidate &&
			(!current.last_update || candidate > current.last_update)
		) {
			current.last_update = candidate;
		}
		healthByNetwork.set(row.network_id, current);
	}

	return networks.map((network) => ({
		...network,
		health: healthByNetwork.get(network.id) ?? emptyHealth(network.id),
	}));
}

function emptyHealth(networkId: string): NetworkOntHealth {
	return {
		network_id: networkId,
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

function formatLastUpdate(iso: string | null): string | null {
	if (!iso) return null;
	const seen = new Date(iso).getTime();
	if (Number.isNaN(seen)) return null;
	const seconds = Math.floor((Date.now() - seen) / 1000);
	if (seconds < 60) return `hace ${seconds}s`;
	if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
	if (seconds < 86_400) return `hace ${Math.floor(seconds / 3600)} h`;
	return `hace ${Math.floor(seconds / 86_400)} d`;
}
