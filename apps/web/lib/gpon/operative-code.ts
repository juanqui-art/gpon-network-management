/**
 * Generación de códigos operativos únicos para activos GPON
 * Convención: {PROV}-{CIUDAD}-{ZONA}-{TIPO}-{SEQ}
 * Ejemplo: PIC-UIO-Z05-NAP-128
 *
 * Basado en: docs/GPON_FTTH_ECUADOR_RESEARCH.md — sección 9
 */

const TYPE_CODE: Record<string, string> = {
	olt: "OLT",
	splitter: "SPL",
	nap: "NAP",
	closure: "MUF",
	ont: "ONT",
	feeder: "FDR",
	distribution: "DST",
	other: "FIB",
	crossing: "CRU",
	reserve: "RES",
	splice: "EMP",
};

const DEFAULT_CITY = "UIO";
const DEFAULT_PROV = "PIC";

export interface ParsedOperativeCode {
	province: string;
	city: string;
	zone: string;
	type: string;
	sequence: string;
}

export interface CodeContext {
	province?: string; // e.g. "PIC" (Pichincha)
	city?: string; // e.g. "UIO" (Quito)
	zone?: string; // e.g. "Z05" — zona operativa
	type: string; // "olt" | "splitter" | "nap" | "feeder" | ...
	sequence: number; // number > 0
}

/**
 * Genera un código operativo siguiendo la convención GPON Ecuador.
 * El código es legible por el técnico y trazable en el sistema.
 */
export function generateOperativeCode(ctx: CodeContext): string {
	const prov = (ctx.province ?? DEFAULT_PROV).toUpperCase();
	const city = (ctx.city ?? DEFAULT_CITY).toUpperCase();
	const zone = (ctx.zone ?? "ZXX").toUpperCase();
	const type = TYPE_CODE[ctx.type] ?? ctx.type.toUpperCase().slice(0, 3);
	const seq = String(ctx.sequence).padStart(3, "0");
	return `${prov}-${city}-${zone}-${type}-${seq}`;
}

export interface CodePrefix {
	province: string;
	city: string;
}

export const DEFAULT_CODE_PREFIX: CodePrefix = {
	province: DEFAULT_PROV,
	city: DEFAULT_CITY,
};

/**
 * Código propuesto para un draft.
 * Debe ser operativo desde el inicio porque puede guardarse sin edición manual.
 * La zona viene de las zonas de la red (`network_zones`); provincia y ciudad
 * se infieren de los códigos existentes (ver `inferCodePrefix`).
 */
export function generateDraftCode(
	type: string,
	sequence: number,
	ctx: { zone: string; prefix?: CodePrefix },
): string {
	const prefix = ctx.prefix ?? DEFAULT_CODE_PREFIX;
	return generateOperativeCode({
		province: prefix.province,
		city: prefix.city,
		zone: ctx.zone,
		type,
		sequence,
	});
}

/** Zone segment: 2–6 letters/digits, no "-" (it separates code parts). */
export const ZONE_CODE_PATTERN = /^[A-Z0-9]{2,6}$/;

export function normalizeZoneCode(raw: string): string | null {
	const code = raw.trim().toUpperCase();
	return ZONE_CODE_PATTERN.test(code) ? code : null;
}

function mostFrequent(values: string[]): string | null {
	const counts = new Map<string, number>();
	let best: string | null = null;
	let bestCount = 0;
	for (const value of values) {
		const count = (counts.get(value) ?? 0) + 1;
		counts.set(value, count);
		if (count > bestCount) {
			best = value;
			bestCount = count;
		}
	}
	return best;
}

/**
 * Provincia-ciudad dominante entre los códigos existentes de la red, para que
 * una red de Cuenca siga generando AZU-CUE-… en vez del default de Quito.
 */
export function inferCodePrefix(
	codes: Array<string | null | undefined>,
): CodePrefix {
	const prefixes = codes
		.map(parseOperativeCode)
		.filter((parsed): parsed is ParsedOperativeCode => parsed !== null)
		.map((parsed) => `${parsed.province}-${parsed.city}`);
	const best = mostFrequent(prefixes);
	if (!best) return DEFAULT_CODE_PREFIX;
	const [province, city] = best.split("-");
	return { province, city };
}

/** Zona más usada en los códigos existentes (excluye drafts "DRF"). */
export function inferZoneCode(
	codes: Array<string | null | undefined>,
): string | null {
	return mostFrequent(
		codes
			.map(parseOperativeCode)
			.filter((parsed): parsed is ParsedOperativeCode => parsed !== null)
			.map((parsed) => parsed.zone)
			.filter((zone) => zone !== "DRF" && zone !== "ZXX"),
	);
}

/**
 * Extrae el número de secuencia de un código operativo existente.
 * Retorna null si no sigue la convención.
 */
export function parseSequence(code: string): number | null {
	const parts = code.split("-");
	if (parts.length < 5) return null;
	const seq = Number.parseInt(parts[4], 10);
	return Number.isNaN(seq) ? null : seq;
}

export function parseOperativeCode(
	code: string | null | undefined,
): ParsedOperativeCode | null {
	if (!code) return null;
	const parts = code.trim().toUpperCase().split("-");
	if (parts.length < 5) return null;
	const [province, city, zone, type, sequence] = parts;
	if (!province || !city || !zone || !type || !sequence) return null;
	return { province, city, zone, type, sequence };
}

export function compactOperativeCode(code: string | null | undefined): string {
	const parsed = parseOperativeCode(code);
	if (!parsed) return code ?? "";
	return `${parsed.type}-${parsed.sequence}`;
}

export function formatMapLabel(
	code: string | null | undefined,
	zoom: number,
): string {
	if (!code) return "";
	if (zoom >= 17) return code;
	return compactOperativeCode(code);
}

export function operativeCodeMatches(
	code: string | null | undefined,
	query: string,
): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) return true;
	const normalizedCode = (code ?? "").toLowerCase();
	const compactCode = compactOperativeCode(code).toLowerCase();
	return (
		normalizedCode.includes(normalizedQuery) ||
		compactCode.includes(normalizedQuery)
	);
}

/**
 * Siguiente número de secuencia dado un array de códigos existentes del mismo tipo.
 */
export function nextSequence(existingCodes: string[]): number {
	const sequences = existingCodes
		.map(parseSequence)
		.filter((n): n is number => n !== null);
	return sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
}
