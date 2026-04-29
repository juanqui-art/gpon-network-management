import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/gpon";
import type { Network } from "@/lib/types/network";
import { NetworkEditorShell } from "./network-editor-shell";

interface Props {
	params: Promise<{ id: string }>;
}

export default async function NetworkEditorPage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	const userRole = (user?.app_metadata?.role ?? null) as UserRole | null;

	const { data: network } = await supabase
		.from("networks")
		.select("id, name, description, topology, created_at, updated_at")
		.eq("id", id)
		.single();

	if (!network) notFound();

	return (
		<NetworkEditorShell
			network={network as Network}
			userRole={userRole}
			networkId={id}
		/>
	);
}
