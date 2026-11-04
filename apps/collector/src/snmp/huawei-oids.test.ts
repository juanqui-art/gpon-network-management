import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	decodeOltPort,
	HUAWEI_INVALID_INT,
	parseDistanceM,
	parseOpticalPowerDbm,
	parseTemperatureC,
	snmpIntToDbm,
} from "./huawei-oids.js";

describe("parseOpticalPowerDbm", () => {
	it("converts centi-dBm to dBm", () => {
		assert.equal(parseOpticalPowerDbm(-1311), -13.11);
		assert.equal(parseOpticalPowerDbm(250), 2.5);
	});

	it("returns null for the Huawei 0x7FFFFFFF no-reading sentinel", () => {
		assert.equal(parseOpticalPowerDbm(HUAWEI_INVALID_INT), null);
		assert.equal(parseOpticalPowerDbm(-HUAWEI_INVALID_INT - 1), null);
	});

	it("returns null when missing or non-finite", () => {
		assert.equal(parseOpticalPowerDbm(undefined), null);
		assert.equal(parseOpticalPowerDbm(Number.NaN), null);
	});

	it("returns null for values outside a physically plausible range", () => {
		assert.equal(parseOpticalPowerDbm(-5001), null); // -50.01 dBm
		assert.equal(parseOpticalPowerDbm(1001), null); // +10.01 dBm
		assert.equal(parseOpticalPowerDbm(-5000), -50);
	});

	it("never produces a value that overflows numeric(5,2)", () => {
		for (const raw of [HUAWEI_INVALID_INT, 99_999_999, -99_999_999, 100_000]) {
			const dbm = parseOpticalPowerDbm(raw);
			assert.ok(dbm === null || Math.abs(dbm) < 1000, `raw=${raw}`);
		}
	});
});

describe("parseTemperatureC", () => {
	it("keeps realistic temperatures and drops the sentinel", () => {
		assert.equal(parseTemperatureC(38), 38);
		assert.equal(parseTemperatureC(-5), -5);
		assert.equal(parseTemperatureC(HUAWEI_INVALID_INT), null);
		assert.equal(parseTemperatureC(500), null);
	});
});

describe("parseDistanceM", () => {
	it("keeps valid integer distances", () => {
		assert.equal(parseDistanceM(0), 0);
		assert.equal(parseDistanceM(1234), 1234);
	});

	it("drops sentinels, negatives and out-of-range distances", () => {
		assert.equal(parseDistanceM(HUAWEI_INVALID_INT), null);
		assert.equal(parseDistanceM(-1), null);
		assert.equal(parseDistanceM(100_001), null);
		assert.equal(parseDistanceM(12.5), null);
	});
});

describe("snmpIntToDbm", () => {
	it("rounds to two decimals", () => {
		assert.equal(snmpIntToDbm(-1300), -13);
		assert.equal(snmpIntToDbm(-1), -0.01);
	});
});

describe("decodeOltPort", () => {
	it("decodes the documented Huawei GPON ifIndex to F/S/P", () => {
		assert.equal(decodeOltPort("4194312192"), "0/2/1");
	});

	it("returns the raw value when it is not a GPON ifIndex", () => {
		assert.equal(decodeOltPort("12345"), "12345");
		assert.equal(decodeOltPort("abc"), "abc");
	});
});
