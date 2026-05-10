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
	const supabase = await createClient();

	const { data: ontRows } = await supabase
		.from("ont_current_state")
		.select("*")
		.eq("olt_host", host)
		.order("ont_logical_id", { ascending: true });

	const readings = (ontRows ?? []) as OntCurrentState[];

	const networkIds = Array.from(new Set(readings.map((r) => r.network_id)));
	const { data: networks } =
		networkIds.length > 0
			? await supabase.from("networks").select("id, name").in("id", networkIds)
			: { data: [] as Array<{ id: string; name: string }> };

	const networkNames = (networks ?? []).map(
		(n) => (n as { id: string; name: string }).name,
	);

	if (!host) notFound();

	return (
		<MonitoringDetailClient
			oltHost={host}
			networkNames={networkNames}
			initialReadings={readings}
		/>
	);
}
