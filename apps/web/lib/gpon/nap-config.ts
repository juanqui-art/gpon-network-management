export type NapMode = "terminal" | "with_splitter" | "prepared";
export type NapConnectorType = "SC/APC" | "SC/UPC" | "Mini SC/APC";
export type NapProtectionRating = "IP65" | "IP68";

export const NAP_MODE_LABEL: Record<NapMode, string> = {
	terminal: "Caja terminal",
	with_splitter: "Con splitter PLC",
	prepared: "Preparada para PLC",
};

export const DEFAULT_NAP_PROPERTIES = {
	nap_mode: "with_splitter",
	connector_type: "SC/APC",
	protection_rating: "IP65",
} satisfies Record<string, string>;

export function getNapMode(element: {
	type?: string;
	properties: Record<string, unknown> | null | undefined;
	split_ratio: unknown;
	total_ports?: number | null;
}): NapMode {
	const mode = element.properties?.nap_mode;
	if (mode === "terminal" || mode === "with_splitter" || mode === "prepared") {
		return mode;
	}
	if (
		element.type === "nap" &&
		element.total_ports &&
		element.total_ports > 0
	) {
		return "with_splitter";
	}
	return element.split_ratio ? "with_splitter" : "terminal";
}

export function hasInternalSplitter(element: {
	type: string;
	properties: Record<string, unknown> | null | undefined;
	split_ratio: unknown;
	total_ports?: number | null;
}): boolean {
	return element.type === "nap" && getNapMode(element) === "with_splitter";
}

export function napPropertyLabel(
	element: {
		properties: Record<string, unknown> | null | undefined;
		split_ratio: unknown;
	},
	key: "connector_type" | "protection_rating",
	fallback: string,
): string {
	const value = element.properties?.[key];
	return typeof value === "string" && value ? value : fallback;
}
