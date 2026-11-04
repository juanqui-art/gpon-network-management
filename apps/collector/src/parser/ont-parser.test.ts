import { describe, expect, it } from "vitest";
import {
	decodeOltPort,
	mapHuaweiStatus,
	snmpIntToDbm,
} from "../snmp/huawei-oids.js";
import { parseOntRows } from "./ont-parser.js";

describe("helpers Huawei", () => {
	it("convierte el entero SNMP a dBm", () => {
		expect(snmpIntToDbm(-1311)).toBe(-13.11);
		expect(snmpIntToDbm(250)).toBe(2.5);
	});

	it("mapea status conocidos y cae a unknown", () => {
		expect(mapHuaweiStatus(1)).toBe("online");
		expect(mapHuaweiStatus(3)).toBe("los");
		expect(mapHuaweiStatus(99)).toBe("unknown");
	});

	it("decodifica el ifIndex GPON a F/S/P", () => {
		expect(decodeOltPort("4194312192")).toBe("0/2/1");
		expect(decodeOltPort(4194304256)).toBe("0/1/2");
		expect(decodeOltPort("no-es-numero")).toBe("no-es-numero");
	});
});

describe("parseOntRows", () => {
	it("convierte una ONT online con telemetría completa", () => {
		const [parsed] = parseOntRows([
			{
				logicalId: "4194312192.5",
				oltPort: "4194312192",
				ontId: "5",
				statusRaw: 1,
				rxPowerRaw: -1850,
				txPowerRaw: 210,
				temperatureRaw: 36,
				distanceM: 1200,
				serial: "HWTC00000005",
				description: "CLIENTE-5",
			},
		]);
		expect(parsed).toEqual({
			ontLogicalId: "4194312192.5",
			ontSerial: "HWTC00000005",
			ontDescription: "CLIENTE-5",
			pon_port: "0/2/1",
			rxPowerDbm: -18.5,
			txPowerDbm: 2.1,
			temperatureC: 36,
			status: "online",
			distanceM: 1200,
			lastDisconnectReason: null,
		});
	});

	it("deja en null la telemetría ausente de una ONT caída", () => {
		const [parsed] = parseOntRows([
			{
				logicalId: "4194312192.6",
				oltPort: "4194312192",
				ontId: "6",
				statusRaw: 2,
				lastDisconnectReason: "los",
			},
		]);
		expect(parsed.status).toBe("offline");
		expect(parsed.rxPowerDbm).toBeNull();
		expect(parsed.temperatureC).toBeNull();
		expect(parsed.lastDisconnectReason).toBe("los");
	});
});
