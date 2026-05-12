import { notFound } from "next/navigation";
import type { SparkPoint } from "@/components/monitoring/rx-sparkline";
import { createClient } from "@/lib/supabase/server";
import type { OntCurrentState, OntSignalHistoryEntry } from "@/lib/types/gpon";
import { MonitoringDetailClient } from "./monitoring-detail-client";

export const metadata = { title: "Monitoreo de OLT" };

interface Props {
	params: Promise<{ host: string }>;
}

export interface OltElementInfo {
	id: string;
	code: string;
	name: string | null;
	status: string;
	optical_class: string | null;
	total_pon_ports: number | null;
	properties: Record<string, unknown>;
	updated_at: string;
}

export default async function MonitoringOltDetailPage({ params }: Props) {
	const { host: rawHost } = await params;
	const host = decodeURIComponent(rawHost);
	if (!host) notFound();

	const supabase = await createClient();

	const [
		{ data: ontRows, error: ontError },
		{ data: oltElement, error: oltError },
	] = await Promise.all([
		supabase
			.from("ont_current_state")
			.select("*")
			.eq("olt_host", host)
			.order("ont_logical_id", { ascending: true }),
		supabase
			.from("infrastructure_elements")
			.select(
				"id, code, name, status, optical_class, total_pon_ports, properties, network_id, updated_at",
			)
			.eq("type", "olt")
			.eq("management_ip", host)
			.maybeSingle(),
	]);

	if (ontError) {
		throw new Error(
			`No se pudo cargar la telemetría de la OLT ${host}: ${ontError.message}`,
		);
	}

	if (oltError) {
		throw new Error(
			`No se pudo cargar la información de infraestructura de la OLT ${host}: ${oltError.message}`,
		);
	}

	const readings = (ontRows ?? []) as OntCurrentState[];

	// Load 24h rx_power history for all ONTs of this OLT (for sparklines)
	const stateIds = readings.map((r) => r.id);
	const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const { data: historyRows } =
		stateIds.length > 0
			? await supabase
					.from("ont_signal_history")
					.select(
						"ont_current_state_id, ont_logical_id, rx_power_dbm, recorded_at",
					)
					.in("ont_current_state_id", stateIds)
					.gte("recorded_at", since24h)
					.order("recorded_at", { ascending: true })
					.limit(3000)
			: { data: [] as Partial<OntSignalHistoryEntry>[] };

	// Group history by logical_id → SparkPoint[]
	const historyByLogicalId = new Map<string, SparkPoint[]>();
	for (const row of historyRows ?? []) {
		if (row.rx_power_dbm === null || row.rx_power_dbm === undefined) continue;
		const id = row.ont_logical_id ?? "";
		const pts = historyByLogicalId.get(id) ?? [];
		pts.push({
			rx_power_dbm: Number(row.rx_power_dbm),
			recorded_at: row.recorded_at ?? "",
		});
		historyByLogicalId.set(id, pts);
	}
	// Convert Map to plain object for serialization
	const initialHistory = Object.fromEntries(historyByLogicalId);

	const networkIdSet = new Set<string>(readings.map((r) => r.network_id));
	if (oltElement?.network_id) networkIdSet.add(oltElement.network_id);

	const { data: networks, error: networksError } =
		networkIdSet.size > 0
			? await supabase
					.from("networks")
					.select("id, name")
					.in("id", Array.from(networkIdSet))
			: { data: [] as Array<{ id: string; name: string }>, error: null };

	if (networksError) {
		throw new Error(
			`No se pudieron cargar las redes asociadas a la OLT ${host}: ${networksError.message}`,
		);
	}

	const networkNames = (networks ?? []).map(
		(n) => (n as { id: string; name: string }).name,
	);

	const elementInfo: OltElementInfo | null = oltElement
		? {
				id: oltElement.id,
				code: oltElement.code,
				name: oltElement.name,
				status: oltElement.status,
				optical_class: oltElement.optical_class,
				total_pon_ports: oltElement.total_pon_ports,
				properties: (oltElement.properties as Record<string, unknown>) ?? {},
				updated_at: oltElement.updated_at,
			}
		: null;

	return (
		<MonitoringDetailClient
			oltHost={host}
			elementInfo={elementInfo}
			networkNames={networkNames}
			initialReadings={readings}
			initialHistory={initialHistory}
		/>
	);
}
