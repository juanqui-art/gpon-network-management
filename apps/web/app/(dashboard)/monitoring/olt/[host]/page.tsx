import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OntCurrentState } from "@/lib/types/gpon";
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

	const [{ data: ontRows }, { data: oltElement }] = await Promise.all([
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

	const readings = (ontRows ?? []) as OntCurrentState[];

	const networkIdSet = new Set<string>(readings.map((r) => r.network_id));
	if (oltElement?.network_id) networkIdSet.add(oltElement.network_id);

	const { data: networks } =
		networkIdSet.size > 0
			? await supabase
					.from("networks")
					.select("id, name")
					.in("id", Array.from(networkIdSet))
			: { data: [] as Array<{ id: string; name: string }> };

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
		/>
	);
}
