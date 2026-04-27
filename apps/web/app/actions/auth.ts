"use server";

import { redirect } from "next/navigation";
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
	if (error) return error.message;
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
		options: { data: { role: "technician" } },
	});
	if (error) return error.message;
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
