import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OntCurrentState } from "@/lib/types/gpon";
import { MonitoringDetailClient } from "./monitoring-detail-client";

export const metadata = { title: "Monitoreo de OLT" };

interface Props {
	params: Promise<{ host: string }>;
}

export default async function MonitoringOltDetailPage({ params }: Props) {
	const { host: rawHost } = await params;
	const host = decodeURIComponent(rawHost);
	if (!host) notFound();

	const supabase = await createClient();

	// Match con infrastructure_elements para tener nombre humano + match con redes
	const [{ data: ontRows }, { data: oltElement }] = await Promise.all([
		supabase
			.from("ont_current_state")
			.select("*")
			.eq("olt_host", host)
			.order("ont_logical_id", { ascending: true }),
		supabase
			.from("infrastructure_elements")
			.select("id, code, name, network_id")
			.eq("type", "olt")
			.eq("management_ip", host)
			.maybeSingle(),
	]);

	const readings = (ontRows ?? []) as OntCurrentState[];

	// Recoger redes desde dos fuentes: telemetría real + elemento OLT (si existe)
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

	const matched = oltElement as {
		id: string;
		code: string;
		name: string | null;
	} | null;

	return (
		<MonitoringDetailClient
			oltHost={host}
			elementCode={matched?.code ?? null}
			elementName={matched?.name ?? null}
			networkNames={networkNames}
			initialReadings={readings}
		/>
	);
}
