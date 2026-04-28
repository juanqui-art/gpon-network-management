export type NetworkTopology = "star" | "tree" | "cascade" | "blank";

export interface Network {
	id: string;
	name: string;
	description: string | null;
	topology: NetworkTopology;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

export interface NetworkSummary {
	id: string;
	name: string;
	description: string | null;
	topology: NetworkTopology;
	element_count: number;
	route_count: number;
	created_at: string;
	updated_at: string;
}

export const TOPOLOGY_LABELS: Record<NetworkTopology, string> = {
	star: "Estrella (1:16)",
	tree: "Árbol dos niveles (1:32)",
	cascade: "Cascada (1:64)",
	blank: "Red en blanco",
};

export const TOPOLOGY_DESCRIPTIONS: Record<NetworkTopology, string> = {
	star: "1 OLT · 1 Splitter 1:16 · 16 NAPs",
	tree: "1 OLT · Splitters 1:4 → 1:8 · 32 NAPs",
	cascade: "1 OLT · Splitters primario/secundario · 64 NAPs",
	blank: "Comienza desde cero",
};
