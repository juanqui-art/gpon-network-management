"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function signIn(
	_: string | null,
	formData: FormData,
): Promise<string | null> {
	const supabase = await createClient();
	const { error } = await supabase.auth.signInWithPassword({
		email: formData.get("email") as string,
		password: formData.get("password") as string,
	});
	if (error) return "Email o contraseña incorrectos";
	redirect("/map");
}

export async function signUp(
	_: string | null,
	formData: FormData,
): Promise<string | null> {
	const supabase = await createClient();
	const { data, error } = await supabase.auth.signUp({
		email: formData.get("email") as string,
		password: formData.get("password") as string,
	});
	if (error) return "No se pudo crear la cuenta";
	if (!data.user) return "No se pudo crear la cuenta";

	// Assign role in app_metadata via service_role — users cannot self-edit app_metadata.
	// Default: 'support' (read-only) until an admin promotes the account.
	const admin = createAdminClient();
	const { error: adminError } = await admin.auth.admin.updateUserById(
		data.user.id,
		{ app_metadata: { role: "support" } },
	);
	if (adminError) return "Error al asignar permisos";

	// If a session was returned, email confirmation is disabled → go to map
	if (data.session) redirect("/map");
	// Otherwise email confirmation is required → go to login
	redirect("/login");
}

export async function signOut(): Promise<void> {
	const supabase = await createClient();
	await supabase.auth.signOut();
	redirect("/login");
}
