/**
 * Turns Supabase / PostgREST / Postgres errors into actionable Spanish
 * messages. Raw messages (English, SQL jargon, constraint names) never reach
 * the UI; the original error is logged for debugging.
 *
 * Auth (gotrue) errors have their own map: lib/auth/supabase-errors.ts.
 */

interface DbErrorLike {
	code?: string | null;
	message?: string | null;
	details?: string | null;
	hint?: string | null;
	status?: number | null;
}

/** Postgres SQLSTATE and PostgREST codes. */
const CODE_MESSAGES: Record<string, string> = {
	"23505":
		"Ya existe un registro con ese valor. Revisa que el código o el nombre no estén repetidos.",
	"23503":
		"No se puede completar porque hay elementos relacionados (rutas, puntos o equipos conectados).",
	"23502": "Falta un dato obligatorio.",
	"23514": "Algún valor está fuera del rango permitido.",
	"22P02": "Hay un valor con formato inválido.",
	"22001": "Algún texto es demasiado largo.",
	"42501": "Tu rol no tiene permiso para esta acción.",
	"57014":
		"El servidor tardó demasiado en responder. Inténtalo de nuevo en unos segundos.",
	PGRST116: "El registro ya no existe o no tienes acceso a él.",
	PGRST301: "Tu sesión expiró. Vuelve a iniciar sesión.",
	PGRST303: "Tu sesión expiró. Vuelve a iniciar sesión.",
};

/** Messages raised by our own RPCs (RAISE EXCEPTION in database/migrations). */
const MESSAGE_PATTERNS: Array<[RegExp, string]> = [
	[
		/network name confirmation does not match/i,
		"El nombre escrito no coincide con el de la red.",
	],
	[/network is already archived/i, "Esta red ya estaba archivada."],
	[/network not found/i, "La red no existe o ya fue archivada."],
	[
		/only administrators can archive/i,
		"Solo un administrador puede archivar redes.",
	],
	[
		/only admin and network_engineer can create zones/i,
		"Solo administración e ingeniería de red pueden crear zonas.",
	],
	[/zone .+ already exists/i, "Esa zona ya existe en esta red."],
	[
		/requires at least two coordinates/i,
		"Una ruta de fibra necesita al menos dos puntos en el mapa.",
	],
	[
		/element .+ not found/i,
		"El elemento ya no existe. Recarga la red para ver los últimos cambios.",
	],
	[
		/route .+ not found/i,
		"La ruta ya no existe. Recarga la red para ver los últimos cambios.",
	],
	[
		/row-level security|permission denied/i,
		"Tu rol no tiene permiso para esta acción.",
	],
	[/jwt expired|invalid jwt/i, "Tu sesión expiró. Vuelve a iniciar sesión."],
	[
		/failed to fetch|networkerror|load failed|fetch failed/i,
		"Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.",
	],
];

export function translateDbError(error: unknown, fallback: string): string {
	if (!error) return fallback;
	const record: DbErrorLike =
		typeof error === "object"
			? (error as DbErrorLike)
			: { message: String(error) };

	const message = [record.message, record.details, record.hint]
		.filter(Boolean)
		.join(" ");
	for (const [pattern, translation] of MESSAGE_PATTERNS) {
		if (pattern.test(message)) return translation;
	}
	if (record.code && CODE_MESSAGES[record.code])
		return CODE_MESSAGES[record.code];
	if (record.status === 401) return CODE_MESSAGES.PGRST301;
	if (record.status === 403) return CODE_MESSAGES["42501"];
	return fallback;
}
