import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HUAWEI_INVALID_INT } from "../snmp/huawei-oids.js";
import { parseOntRows } from "./ont-parser.js";

const BASE = {
	logicalId: "4194312192.5",
	oltPort: "4194312192",
	ontId: "5",
};

describe("parseOntRows", () => {
	it("parses an online ONT", () => {
		const [reading] = parseOntRows([
			{
				...BASE,
				statusRaw: 1,
				rxPowerRaw: -1850,
				txPowerRaw: 210,
				temperatureRaw: 41,
				distanceM: 1830,
				serial: "HWTC00000001",
			},
		]);
		assert.deepEqual(reading, {
			ontLogicalId: "4194312192.5",
			ontSerial: "HWTC00000001",
			ontDescription: null,
			pon_port: "0/2/1",
			rxPowerDbm: -18.5,
			txPowerDbm: 2.1,
			temperatureC: 41,
			status: "online",
			distanceM: 1830,
			lastDisconnectReason: null,
		});
	});

	it("maps Huawei no-reading sentinels on an offline ONT to null", () => {
		const [reading] = parseOntRows([
			{
				...BASE,
				statusRaw: 2,
				rxPowerRaw: HUAWEI_INVALID_INT,
				txPowerRaw: HUAWEI_INVALID_INT,
				temperatureRaw: HUAWEI_INVALID_INT,
				distanceM: -1,
				lastDisconnectReason: "los",
			},
		]);
		assert.equal(reading.status, "offline");
		assert.equal(reading.rxPowerDbm, null);
		assert.equal(reading.txPowerDbm, null);
		assert.equal(reading.temperatureC, null);
		assert.equal(reading.distanceM, null);
		assert.equal(reading.lastDisconnectReason, "los");
	});

	it("marks unknown status codes as unknown", () => {
		const [missing, weird] = parseOntRows([BASE, { ...BASE, statusRaw: 99 }]);
		assert.equal(missing.status, "unknown");
		assert.equal(weird.status, "unknown");
	});
});
