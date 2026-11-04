import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OntReading } from "../parser/ont-parser.js";
import { buildStateBatches, type OntWithTrigger } from "./supabase.js";

const CTX = {
	networkId: "net-1",
	oltHost: "10.0.0.1",
	now: "2026-11-04T12:00:00.000Z",
};

function reading(
	ontLogicalId: string,
	status: OntReading["status"],
): OntWithTrigger {
	return {
		trigger: null,
		reading: {
			ontLogicalId,
			ontSerial: null,
			ontDescription: null,
			pon_port: "0/2/1",
			rxPowerDbm: status === "online" ? -18.2 : null,
			txPowerDbm: null,
			temperatureC: null,
			status,
			distanceM: null,
			lastDisconnectReason: null,
		},
	};
}

describe("buildStateBatches", () => {
	it("sets last_seen_at only on online ONTs", () => {
		const { seen, unseen } = buildStateBatches(
			[
				reading("p.1", "online"),
				reading("p.2", "offline"),
				reading("p.3", "los"),
			],
			CTX,
		);

		assert.deepEqual(
			seen.map((row) => [row.ont_logical_id, row.last_seen_at]),
			[["p.1", CTX.now]],
		);
		assert.deepEqual(
			unseen.map((row) => row.ont_logical_id),
			["p.2", "p.3"],
		);
	});

	it("omits the last_seen_at key entirely for non-online ONTs", () => {
		// Si la clave existiera (aunque fuera null), el UPSERT borraría la
		// última conexión conocida de la ONT.
		const { unseen } = buildStateBatches([reading("p.2", "offline")], CTX);
		assert.equal(Object.hasOwn(unseen[0], "last_seen_at"), false);
	});

	it("keeps each batch homogeneous in columns", () => {
		const { seen, unseen } = buildStateBatches(
			[
				reading("a", "online"),
				reading("b", "online"),
				reading("c", "offline"),
				reading("d", "unknown"),
			],
			CTX,
		);
		for (const batch of [seen, unseen]) {
			const shapes = new Set(batch.map((row) => Object.keys(row).join(",")));
			assert.equal(shapes.size, 1);
		}
	});

	it("stamps network and OLT on every row", () => {
		const { seen, unseen } = buildStateBatches(
			[reading("a", "online"), reading("b", "offline")],
			CTX,
		);
		for (const row of [...seen, ...unseen]) {
			assert.equal(row.network_id, CTX.networkId);
			assert.equal(row.olt_host, CTX.oltHost);
		}
	});
});
