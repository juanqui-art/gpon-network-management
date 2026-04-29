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
	redirect("/dashboard");
}

export async function signUp(
	_: string | null,
	formData: FormData,
): Promise<string | null> {
	const password = formData.get("password") as string;
	if (password.length < 8)
		return "La contraseña debe tener al menos 8 caracteres";

	const supabase = await createClient();
	const { data, error } = await supabase.auth.signUp({
		email: formData.get("email") as string,
		password,
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

export async function requestPasswordReset(
	_: string | null,
	formData: FormData,
): Promise<string | null> {
	const email = formData.get("email") as string;
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
	const supabase = await createClient();
	// Always returns the same message regardless of whether the email exists
	// to avoid user enumeration.
	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
	});
	if (error) return "No se pudo enviar el enlace de recuperación";
	return "Si el email existe, recibirás un enlace en breve";
}

export async function updatePassword(
	_: string | null,
	formData: FormData,
): Promise<string | null> {
	const password = formData.get("password") as string;
	const confirm = formData.get("confirm") as string;
	if (password.length < 8)
		return "La contraseña debe tener al menos 8 caracteres";
	if (password !== confirm) return "Las contraseñas no coinciden";
	const supabase = await createClient();
	const { error } = await supabase.auth.updateUser({ password });
	if (error) return "No se pudo actualizar la contraseña";
	redirect("/map");
}

export async function signOut(): Promise<void> {
	const supabase = await createClient();
	// Invalidate all devices, not just the current session.
	await supabase.auth.signOut({ scope: "global" });
	redirect("/login");
}
