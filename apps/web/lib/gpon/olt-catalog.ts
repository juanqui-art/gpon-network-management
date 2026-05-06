/**
 * OLT Catalog — modelos reales con especificaciones ópticas
 * Basado en equipos comunes en despliegues Ecuador
 */

import type { PonStandard } from "@/lib/types/gpon";

export interface OltModel {
	id: string;
	manufacturer: string;
	model: string;
	ponStandard: PonStandard;
	opticalClass: string; // "B+", "C+", etc.
	maxPowerDbm: number;
	defaultTxPowerDbm?: number;
	rxSensitivityDbm?: number;
	maxPonPorts: number;
	serviceSlotsTotal?: number;
	controlSlotsTotal?: number;
	ponPortsPerCard?: number;
	notes: string;
}

export const OLT_CATALOG: Record<string, OltModel> = {
	huawei_ma5800_x7: {
		id: "huawei_ma5800_x7",
		manufacturer: "Huawei",
		model: "MA5800-X7",
		ponStandard: "gpon",
		opticalClass: "B+",
		maxPowerDbm: 28,
		defaultTxPowerDbm: 3,
		rxSensitivityDbm: -28,
		maxPonPorts: 16,
		serviceSlotsTotal: 7,
		controlSlotsTotal: 2,
		ponPortsPerCard: 16,
		notes: "GPON Clase B+, ideal para redes urbanas y periféricas",
	},

	huawei_ma5800_x15: {
		id: "huawei_ma5800_x15",
		manufacturer: "Huawei",
		model: "MA5800-X15",
		ponStandard: "gpon",
		opticalClass: "C+",
		maxPowerDbm: 32,
		defaultTxPowerDbm: 5,
		rxSensitivityDbm: -30,
		maxPonPorts: 32,
		serviceSlotsTotal: 15,
		controlSlotsTotal: 2,
		ponPortsPerCard: 16,
		notes: "GPON Clase C+, para zonas rurales con splitters en cascada",
	},

	zte_c300: {
		id: "zte_c300",
		manufacturer: "ZTE",
		model: "C300",
		ponStandard: "gpon",
		opticalClass: "C+",
		maxPowerDbm: 32,
		defaultTxPowerDbm: 5,
		rxSensitivityDbm: -30,
		maxPonPorts: 224,
		serviceSlotsTotal: 14,
		controlSlotsTotal: 2,
		ponPortsPerCard: 16,
		notes: "GPON Clase C+, equipamiento ZTE común en Ecuador",
	},

	zte_c320: {
		id: "zte_c320",
		manufacturer: "ZTE",
		model: "C320",
		ponStandard: "gpon",
		opticalClass: "C++",
		maxPowerDbm: 35,
		defaultTxPowerDbm: 7,
		rxSensitivityDbm: -32,
		maxPonPorts: 32,
		serviceSlotsTotal: 2,
		controlSlotsTotal: 2,
		ponPortsPerCard: 16,
		notes: "GPON Clase C++, versión mejorada para zonas suburbanas",
	},

	nokia_7360_isam: {
		id: "nokia_7360_isam",
		manufacturer: "Nokia",
		model: "7360 ISAM",
		ponStandard: "gpon",
		opticalClass: "B+",
		maxPowerDbm: 28,
		defaultTxPowerDbm: 3,
		rxSensitivityDbm: -28,
		maxPonPorts: 16,
		serviceSlotsTotal: 5,
		controlSlotsTotal: 2,
		ponPortsPerCard: 16,
		notes: "GPON Clase B+, equipamiento Nokia de alta confiabilidad",
	},

	calix_e7: {
		id: "calix_e7",
		manufacturer: "Calix",
		model: "E7",
		ponStandard: "gpon",
		opticalClass: "B+",
		maxPowerDbm: 28,
		defaultTxPowerDbm: 3,
		rxSensitivityDbm: -28,
		maxPonPorts: 16,
		serviceSlotsTotal: 2,
		controlSlotsTotal: 1,
		ponPortsPerCard: 8,
		notes: "GPON Clase B+, OLT modular Calix",
	},

	xgspon_huawei: {
		id: "xgspon_huawei",
		manufacturer: "Huawei",
		model: "MA5800-X7 (XGS-PON)",
		ponStandard: "xgs_pon",
		opticalClass: "N1",
		maxPowerDbm: 29,
		defaultTxPowerDbm: 4,
		rxSensitivityDbm: -28,
		maxPonPorts: 16,
		serviceSlotsTotal: 7,
		controlSlotsTotal: 2,
		ponPortsPerCard: 16,
		notes: "XGS-PON Clase N1, para futuro upgrade a 10G",
	},
};

export function listOltModels(): OltModel[] {
	return Object.values(OLT_CATALOG);
}

export function getOltModel(id: string): OltModel | undefined {
	return OLT_CATALOG[id];
}

export function getOltsByManufacturer(manufacturer: string): OltModel[] {
	return Object.values(OLT_CATALOG).filter(
		(olt) => olt.manufacturer === manufacturer,
	);
}

export function getOltsByStandard(standard: PonStandard): OltModel[] {
	return Object.values(OLT_CATALOG).filter(
		(olt) => olt.ponStandard === standard,
	);
}

export const OLT_MANUFACTURERS = ["Huawei", "ZTE", "Nokia", "Calix"] as const;
