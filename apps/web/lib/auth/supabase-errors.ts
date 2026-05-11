// Map Supabase auth errors (English, from gotrue) to localized Spanish messages.
// Prefer `error.code` (stable across versions); fall back to message patterns
// for older error shapes that only ship a string.

interface TranslatableError {
	code?: string | null;
	message?: string | null;
	status?: number | null;
}

const CODE_MAP: Record<string, string> = {
	over_email_send_rate_limit:
		"Supabase rechazó el envío: límite de emails alcanzado. Reintentá en ~1 hora o configurá SMTP custom.",
	over_request_rate_limit:
		"Demasiadas peticiones a Supabase. Reintentá en unos segundos.",
	user_already_exists: "Ya existe un usuario con ese email.",
	email_exists: "Ya existe un usuario con ese email.",
	email_address_invalid: "El email no tiene un formato válido.",
	email_address_not_authorized:
		"Email no autorizado por el proveedor SMTP de Supabase.",
	weak_password: "La contraseña es demasiado débil.",
	same_password: "La nueva contraseña debe ser distinta de la anterior.",
	user_not_found: "Usuario no encontrado.",
	signup_disabled: "Los registros públicos están deshabilitados.",
	email_not_confirmed: "El email aún no está confirmado.",
	otp_expired: "El enlace caducó. Solicitá uno nuevo.",
};

const MESSAGE_PATTERNS: Array<[RegExp, string]> = [
	[/email rate limit/i, CODE_MAP.over_email_send_rate_limit],
	[/already.*registered/i, CODE_MAP.user_already_exists],
	[/invalid.*email/i, CODE_MAP.email_address_invalid],
	[/weak.*password|password.*weak/i, CODE_MAP.weak_password],
	[/same.*password/i, CODE_MAP.same_password],
	[/user.*not.*found/i, CODE_MAP.user_not_found],
];

export function translateAuthError(
	error: TranslatableError | null | undefined,
	fallback: string,
): string {
	if (!error) return fallback;
	if (error.code && CODE_MAP[error.code]) return CODE_MAP[error.code];
	if (error.message) {
		for (const [pattern, translation] of MESSAGE_PATTERNS) {
			if (pattern.test(error.message)) return translation;
		}
	}
	return fallback;
}
