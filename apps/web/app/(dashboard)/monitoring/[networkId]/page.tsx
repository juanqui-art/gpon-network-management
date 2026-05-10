import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OntCurrentState } from "@/lib/types/gpon";
import type { Network } from "@/lib/types/network";
import { MonitoringDetailClient } from "./monitoring-detail-client";

export const metadata = { title: "Monitoreo de red" };

interface Props {
	params: Promise<{ networkId: string }>;
}

export default async function MonitoringDetailPage({ params }: Props) {
	const { networkId } = await params;
	const supabase = await createClient();

	const [{ data: network }, { data: ontRows }] = await Promise.all([
		supabase
			.from("networks")
			.select("id, name, description, topology, created_at, updated_at")
			.eq("id", networkId)
			.single(),
		supabase
			.from("ont_current_state")
			.select("*")
			.eq("network_id", networkId)
			.order("ont_logical_id", { ascending: true }),
	]);

	if (!network) notFound();

	return (
		<MonitoringDetailClient
			network={network as Network}
			initialReadings={(ontRows ?? []) as OntCurrentState[]}
		/>
	);
}
