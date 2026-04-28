import { createClient } from "@/lib/supabase/server";
import type { NetworkSummary } from "@/lib/types/network";
import { NetworksClient } from "./networks-client";

export const metadata = { title: "Redes GPON" };

export default async function NetworksPage() {
	const supabase = await createClient();
	const { data: networks } = await supabase.rpc("list_networks");

	return <NetworksClient networks={(networks ?? []) as NetworkSummary[]} />;
}
