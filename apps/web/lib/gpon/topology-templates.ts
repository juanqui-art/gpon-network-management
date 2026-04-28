/**
 * GPON Topology Templates — pre-configured network architectures for Ecuador
 * Based on GPON_FTTH_ECUADOR_RESEARCH.md findings
 */

import type {
	InfrastructureElement,
	FiberRoute,
} from "@/components/map/types";

export type TopologyTemplate = "star" | "tree" | "cascade" | "blank";

export interface TopologyConfig {
	name: string;
	description: string;
	region: string; // e.g., "QUITO-Z05"
	oltCount: number;
	splittersByOlt: number[];
	napsByRegion: number;
	estimatedCoverage: string;
	useCase: string;
	fiberEstimate: string;
}

// ── Topology specifications for Ecuador ──────────────────────────────────────

export const TOPOLOGY_CONFIGS: Record<TopologyTemplate, TopologyConfig> = {
	star: {
		name: "Estrella Centralizada (1:16)",
		description:
			"División centralizada — ideal para zonas densas, edificios, zonas ordenadas. Fácil diagnóstico, más fibra de distribución.",
		region: "QUITO",
		oltCount: 1,
		splittersByOlt: [16],
		napsByRegion: 16,
		estimatedCoverage: "1-2 km² urbano denso",
		useCase: "Centros urbanos, edificios multidwelling (MDU)",
		fiberEstimate: "~40-60 km feeder+distribution",
	},

	tree: {
		name: "Árbol Balanceado (1:32)",
		description:
			"Dos niveles de splitters — expansiones urbanas/periféricas. Ahorra fibra, aumenta puntos de falla.",
		region: "QUITO",
		oltCount: 1,
		splittersByOlt: [4, 8], // 4 primarios → 8 secundarios c/u = 32 NAPs
		napsByRegion: 32,
		estimatedCoverage: "3-5 km² urbano/periférico",
		useCase: "Expansiones urbanas, zonas residenciales medianas",
		fiberEstimate: "~80-120 km feeder+distribution",
	},

	cascade: {
		name: "Cascada Balanceada (1:64)",
		description:
			"Múltiples niveles de splitters — zonas rurales/suburbanas. Reduce CAPEX, exige cálculo óptico cuidadoso.",
		region: "QUITO",
		oltCount: 1,
		splittersByOlt: [2, 4, 8], // 2 primarios → 4 c/u (8) → 8 c/u (64) = 64 NAPs
		napsByRegion: 64,
		estimatedCoverage: "5-10 km² rural/suburbano",
		useCase: "Zonas rurales, expansiones suburbanas",
		fiberEstimate: "~150-220 km feeder+distribution",
	},

	blank: {
		name: "Red en Blanco",
		description: "Comienza desde cero — para diseños personalizados.",
		region: "CUSTOM",
		oltCount: 0,
		splittersByOlt: [],
		napsByRegion: 0,
		estimatedCoverage: "Variable",
		useCase: "Diseño personalizado",
		fiberEstimate: "A definir",
	},
};

// ── Helper to generate unique operational codes ────────────────────────────

function uid(): string {
	return crypto.randomUUID();
}

// Common nullable fields required by InfrastructureElement
const BASE_ELEMENT = {
	organization_id: null,
	address_reference: null,
	pon_standard: null,
	insertion_loss_db: null,
	ports_used: null,
	ports_reserved: null,
	properties: {} as Record<string, unknown>,
	created_by: null,
	updated_by: null,
} as const;

function generateCode(zone: string, type: "olt" | "splitter" | "nap", index: number): string {
	const typeCode = { olt: "OLT", splitter: "SPL", nap: "NAP" } as const;
	return `PIC-UIO-${zone}-${typeCode[type]}-${String(index + 1).padStart(3, "0")}`;
}

// ── Generate topology networks ───────────────────────────────────────────────

export interface GeneratedTopology {
	elements: InfrastructureElement[];
	routes: FiberRoute[];
	metadata: {
		template: TopologyTemplate;
		config: TopologyConfig;
		generatedAt: string;
		elementCount: number;
		routeCount: number;
	};
}

/**
 * Generate a complete topology with elements and routes positioned geographically
 * Base position: Quito center (default), customizable
 */
export function generateTopology(
	template: TopologyTemplate,
	baseLng: number = -78.5249,
	baseLat: number = -0.2194,
): GeneratedTopology {
	if (template === "blank") {
		return {
			elements: [],
			routes: [],
			metadata: {
				template: "blank",
				config: TOPOLOGY_CONFIGS.blank,
				generatedAt: new Date().toISOString(),
				elementCount: 0,
				routeCount: 0,
			},
		};
	}

	const config = TOPOLOGY_CONFIGS[template];
	const elements: InfrastructureElement[] = [];
	const routes: FiberRoute[] = [];
	let elementIndex = 0;

	// ── 1. OLT (Optical Line Terminal) ───────────────────────────────────────

	const oltIndex = 0;
	const olt: InfrastructureElement = {
		...BASE_ELEMENT,
		id: uid(),
		type: "olt",
		code: generateCode("Z05", "olt", oltIndex),
		name: `OLT Quito ${config.region}`,
		status: "active",
		location_quality: "gps_captured",
		lng: baseLng,
		lat: baseLat + 0.01,
		total_pon_ports: config.splittersByOlt.length * 8,
		split_ratio: null,
		total_ports: null,
		notes: `Cabecera de red ${template}. ${config.oltCount} puerto PON principal.`,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};
	elements.push(olt);
	elementIndex += 1;

	// ── 2. Splitters (by level) ──────────────────────────────────────────────

	interface SplitterNode {
		id: string;
		code: string;
		level: number;
		index: number;
		parentId: string;
		children: SplitterNode[];
		lng: number;
		lat: number;
	}

	const splitterTree: SplitterNode[] = [];

	function createSplitterLevel(
		level: number,
		parentId: string,
		count: number,
		parentLng: number,
		parentLat: number,
		spacing: number,
	): SplitterNode[] {
		const nodes: SplitterNode[] = [];
		const startLng = parentLng - (spacing * (count - 1)) / 2;

		for (let i = 0; i < count; i++) {
			const splId = uid();
			const splitRatio = `1:${config.splittersByOlt[level] || 16}` as import("@/lib/types/gpon").SplitRatio;

			const spl: InfrastructureElement = {
				...BASE_ELEMENT,
				id: splId,
				type: "splitter",
				code: generateCode("Z05", "splitter", elementIndex),
				name: `Splitter L${level + 1}-${i + 1} (${splitRatio})`,
				status: "active",
				location_quality: "gps_captured",
				lng: startLng + spacing * i,
				lat: parentLat - (level + 1) * 0.02,
				total_pon_ports: null,
				split_ratio: splitRatio,
				total_ports: null,
				notes: `Nivel ${level + 1}, índice ${i + 1}. Ratio ${splitRatio}.`,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			elements.push(spl);

			// Route from parent
			const route: FiberRoute = {
				id: uid(),
				type: "feeder",
				code: `PIC-UIO-Z05-FDR-${String(routes.length + 1).padStart(3, "0")}`,
				from_element_id: parentId,
				to_element_id: splId,
				from_element_type: level === 0 ? "olt" : "splitter",
				to_element_type: "splitter",
				geojson_coordinates: [
					[parentLng, parentLat],
					[spl.lng, spl.lat],
				],
				fiber_type: "g652d",
				fiber_count: 1,
				length_meters: Math.round(
					Math.sqrt(
						Math.pow((spl.lng - parentLng) * 111 * 1000, 2) +
							Math.pow((spl.lat - parentLat) * 111 * 1000, 2),
					),
				),
				status: "active",
				location_quality: "gps_captured",
				notes: `Feeder L${level} → L${level + 1}`,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};
			routes.push(route);

			const node: SplitterNode = {
				id: splId,
				code: spl.code,
				level,
				index: i,
				parentId,
				children: [],
				lng: spl.lng,
				lat: spl.lat,
			};
			nodes.push(node);
			elementIndex += 1;
		}

		return nodes;
	}

	// Build splitter hierarchy
	let currentLevel: SplitterNode[] = [];
	let parentId = olt.id;
	let parentLng = baseLng;
	let parentLat = baseLat + 0.01;

	for (let level = 0; level < config.splittersByOlt.length; level++) {
		const count = config.splittersByOlt[level];
		const spacing = 0.008 * Math.pow(1.5, level); // Increasing spacing per level

		const newLevel = createSplitterLevel(
			level,
			parentId,
			count,
			parentLng,
			parentLat,
			spacing,
		);

		if (level === 0) {
			currentLevel = newLevel;
		} else {
			// Connect previous level's children
			for (const parent of currentLevel) {
				const childCount = count / currentLevel.length;
				const startIdx = parent.index * childCount;
				const endIdx = startIdx + childCount;
				parent.children = newLevel.slice(startIdx, endIdx);
			}
		}

		parentId = newLevel[0].id;
		parentLng = newLevel[0].lng;
		parentLat = newLevel[0].lat;
		currentLevel = newLevel;
	}

	// ── 3. NAPs (Network Access Points) ──────────────────────────────────────

	const napParents = currentLevel.length > 0 ? currentLevel : [{ id: olt.id, lng: baseLng, lat: baseLat + 0.01 }];
	const napsPerParent = Math.ceil(config.napsByRegion / napParents.length);

	for (let p = 0; p < napParents.length; p++) {
		const parent = napParents[p];
		const napSpacing = 0.004;

		for (let n = 0; n < napsPerParent && elements.length - (olt.id ? 1 : 0) < config.napsByRegion; n++) {
			const napId = uid();
			const parentLng = parent.lng ?? baseLng;
			const parentLat = parent.lat ?? baseLat;

			const nap: InfrastructureElement = {
				id: napId,
				type: "nap",
				code: generateCode("Z05", "nap", elementIndex),
				name: `NAP Z05-${elementIndex + 1}`,
				status: "active",
				location_quality: "approximate",
				lng: parentLng + (Math.random() - 0.5) * napSpacing,
				lat: parentLat - 0.015 + (Math.random() - 0.5) * napSpacing,
				total_pon_ports: null,
				split_ratio: null,
				total_ports: 8,
				notes: `NAP con 8 puertos. Zona 05.`,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			elements.push(nap);

			// Distribution route from splitter/OLT to NAP
			const route: FiberRoute = {
				id: uid(),
				type: "distribution",
				code: `PIC-UIO-Z05-DST-${String(routes.length + 1).padStart(3, "0")}`,
				from_element_id: parent.id,
				to_element_id: napId,
				from_element_type: parent === olt ? "olt" : "splitter",
				to_element_type: "nap",
				geojson_coordinates: [
					[parentLng, parentLat],
					[nap.lng, nap.lat],
				],
				fiber_type: "g657a1",
				fiber_count: 1,
				length_meters: Math.round(
					Math.sqrt(
						Math.pow((nap.lng - parentLng) * 111 * 1000, 2) +
							Math.pow((nap.lat - parentLat) * 111 * 1000, 2),
					),
				),
				status: "active",
				location_quality: "approximate",
				notes: `Distribution a NAP. Tipo G.657.A1.`,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			routes.push(route);
			elementIndex += 1;
		}
	}

	return {
		elements,
		routes,
		metadata: {
			template,
			config,
			generatedAt: new Date().toISOString(),
			elementCount: elements.length,
			routeCount: routes.length,
		},
	};
}

// ── Export helpers for quick access ──────────────────────────────────────────

export function getTopologyTemplate(template: TopologyTemplate): TopologyConfig {
	return TOPOLOGY_CONFIGS[template];
}

export function listTopologyTemplates(): Array<{
	id: TopologyTemplate;
	config: TopologyConfig;
}> {
	return Object.entries(TOPOLOGY_CONFIGS).map(([id, config]) => ({
		id: id as TopologyTemplate,
		config,
	}));
}
