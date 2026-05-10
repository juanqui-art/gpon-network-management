import type { RawOntRow, SnmpSession } from "./types.js";

// Genera 16 ONTs sintéticas con telemetría variable.
// Cada poll varía rx_power ±0.5 dB para simular fluctuación natural,
// y 5% de ONTs cambian de status (online ↔ offline) por poll.
//
// El olt_port se mantiene constante (4194312192 = base slot 2 port 1 en Huawei),
// lo que simula 16 ONTs en el mismo PON port.

const BASE_OLT_PORT = "4194312192";
const ONT_COUNT = 16;

// Estado interno: rx_power y status de cada ONT entre polls
interface MockOntState {
	rxPower: number; // INT × 100 (igual que SNMP real)
	txPower: number;
	temperature: number;
	distanceM: number;
	status: number; // 1=online, 2=offline
	serial: string;
	description: string;
}

function initialState(index: number): MockOntState {
	// rx_power inicial: -13 dB ± 1 dB → -1300 ± 100 (en SNMP int)
	const rxBase = -1300 + Math.floor((Math.random() - 0.5) * 200);
	const txBase = -100 + Math.floor((Math.random() - 0.5) * 50);

	return {
		rxPower: rxBase,
		txPower: txBase,
		temperature: 32 + Math.floor(Math.random() * 8), // 32-40°C
		distanceM: 200 + Math.floor(Math.random() * 1500), // 200-1700m
		status: 1, // todas arrancan online
		serial: `HWTC${String(index).padStart(8, "0")}`,
		description: `MOCK-CLIENT-${index + 1}`,
	};
}

export function createMockSession(): SnmpSession {
	const state = new Map<string, MockOntState>();
	for (let i = 0; i < ONT_COUNT; i++) {
		state.set(String(i + 1), initialState(i));
	}

	return {
		async pollOnts(): Promise<RawOntRow[]> {
			const rows: RawOntRow[] = [];

			for (const [ontId, current] of state) {
				// Variación natural: rx_power ±0.5 dB entre polls
				current.rxPower += Math.floor((Math.random() - 0.5) * 100);
				// Clamp entre -2800 (-28 dB, muerto) y -800 (-8 dB, muy fuerte)
				current.rxPower = Math.max(-2800, Math.min(-800, current.rxPower));

				// 5% probabilidad de cambiar de status
				if (Math.random() < 0.05) {
					current.status = current.status === 1 ? 2 : 1;
				}

				const row: RawOntRow = {
					logicalId: `${BASE_OLT_PORT}.${ontId}`,
					oltPort: BASE_OLT_PORT,
					ontId,
					statusRaw: current.status,
					serial: current.serial,
					description: current.description,
					distanceM: current.distanceM,
				};

				// Solo poblar telemetría óptica cuando está online
				if (current.status === 1) {
					row.rxPowerRaw = current.rxPower;
					row.txPowerRaw = current.txPower;
					row.temperatureRaw = current.temperature;
				} else {
					row.lastDisconnectReason = "los";
				}

				rows.push(row);
			}

			// Pequeño delay para simular tiempo de respuesta SNMP real (~200ms)
			await new Promise((resolve) => setTimeout(resolve, 200));

			return rows;
		},

		close() {
			// no-op para mock
		},
	};
}
