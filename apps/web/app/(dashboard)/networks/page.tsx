import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/gpon";
import type { NetworkSummary } from "@/lib/types/network";
import { NetworksClient } from "./networks-client";

export const metadata = { title: "Redes GPON" };

export default async function NetworksPage() {
	const supabase = await createClient();
	const [
		{
			data: { user },
		},
		{ data: networks },
	] = await Promise.all([
		supabase.auth.getUser(),
		supabase.rpc("list_networks"),
	]);
	const userRole = (user?.app_metadata?.role ?? null) as UserRole | null;

	return (
		<NetworksClient
			networks={(networks ?? []) as NetworkSummary[]}
			userRole={userRole}
		/>
	);
}
