"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
	checkPasswordResetRateLimit,
	checkSignInRateLimit,
} from "@/lib/auth/rate-limit";
import { translateAuthError } from "@/lib/auth/supabase-errors";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const RECOVERY_COOKIE = "pw-recovery";

function formatRetry(seconds: number): string {
	if (seconds < 60) return `${seconds} segundos`;
	const minutes = Math.ceil(seconds / 60);
	return `${minutes} minuto${minutes === 1 ? "" : "s"}`;
}

export async function signIn(
	_: string | null,
	formData: FormData,
): Promise<string | null> {
	const email = String(formData.get("email") ?? "");
	const limit = await checkSignInRateLimit(email);
	if (!limit.ok) {
		return `Demasiados intentos. Inténtalo de nuevo en ${formatRetry(limit.retryAfterSeconds)}.`;
	}

	const supabase = await createClient();
	const { error } = await supabase.auth.signInWithPassword({
		email,
		password: formData.get("password") as string,
	});
	if (error) return "Email o contraseña incorrectos";
	redirect("/dashboard");
}

export async function requestPasswordReset(
	_: string | null,
	formData: FormData,
): Promise<string | null> {
	const limit = await checkPasswordResetRateLimit();
	if (!limit.ok) {
		return `Demasiados intentos. Inténtalo de nuevo en ${formatRetry(limit.retryAfterSeconds)}.`;
	}

	const email = formData.get("email") as string;
	const supabase = await createClient();
	// Always returns the same message regardless of whether the email exists
	// to avoid user enumeration.
	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password`,
	});
	if (error) return "No se pudo enviar el enlace de recuperación";
	return "Si el email existe, recibirás un enlace en breve";
}

export async function updatePassword(
	_: string | null,
	formData: FormData,
): Promise<string | null> {
	const cookieStore = await cookies();
	const recovery = cookieStore.get(RECOVERY_COOKIE);
	if (!recovery || recovery.value !== "1") {
		return "Enlace inválido o expirado. Solicita uno nuevo desde el login.";
	}

	const password = formData.get("password") as string;
	const confirm = formData.get("confirm") as string;
	if (password.length < 8)
		return "La contraseña debe tener al menos 8 caracteres";
	if (password !== confirm) return "Las contraseñas no coinciden";
	const supabase = await createClient();
	const { error } = await supabase.auth.updateUser({ password });
	if (error)
		return translateAuthError(error, "No se pudo actualizar la contraseña");
	cookieStore.delete(RECOVERY_COOKIE);
	// Revoke other devices in case the account was compromised before reset.
	await supabase.auth.signOut({ scope: "others" });
	redirect("/map");
}

export async function signOut(): Promise<void> {
	const supabase = await createClient();
	// Invalidate all devices, not just the current session.
	await supabase.auth.signOut({ scope: "global" });
	redirect("/login");
}
