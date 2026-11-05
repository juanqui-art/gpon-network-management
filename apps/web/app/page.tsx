import { redirect } from "next/navigation";
import { getUserRoleFromMetadata, homePathForRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	redirect(homePathForRole(getUserRoleFromMetadata(user?.app_metadata)));
}
