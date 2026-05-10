import snmp from "net-snmp";
import { HUAWEI_OID } from "./huawei-oids.js";
import type { RawOntRow, SnmpSession } from "./types.js";

interface CreateRealSessionOptions {
	host: string;
	community: string;
	port: number;
	timeoutMs: number;
	retries: number;
}

// Walk de un subárbol OID, devolviendo un mapa indexado por la "tail"
// del OID (todo lo que viene después del baseOid).
// Ej: si baseOid="1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4" y vuelve
// "1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4.4194312192.5" = -1311,
// retorna { "4194312192.5": -1311 }
function walkSubtree(
	session: snmp.Session,
	baseOid: string,
): Promise<Map<string, snmp.Varbind["value"]>> {
	return new Promise((resolve, reject) => {
		const result = new Map<string, snmp.Varbind["value"]>();

		const onVarbind = (varbinds: snmp.Varbind[]): void => {
			for (const vb of varbinds) {
				if (snmp.isVarbindError(vb)) {
					// Saltamos varbinds con error (ej: noSuchInstance)
					continue;
				}
				const tail = vb.oid.startsWith(`${baseOid}.`)
					? vb.oid.slice(baseOid.length + 1)
					: vb.oid;
				result.set(tail, vb.value);
			}
		};

		const onDone = (error: Error | null): void => {
			if (error) {
				reject(error);
			} else {
				resolve(result);
			}
		};

		session.subtree(baseOid, 20, onVarbind, onDone);
	});
}

function fullOid(subtree: string, column: number): string {
	return `${HUAWEI_OID.ONT_BASE}.${subtree}.1.${column}`;
}

// Convierte el index "olt_port.ont_id" en sus componentes.
// Si el index tiene más segmentos (improbable), tomamos los primeros dos.
function splitIndex(index: string): { oltPort: string; ontId: string } {
	const parts = index.split(".");
	return {
		oltPort: parts[0] ?? "",
		ontId: parts.slice(1).join(".") || "",
	};
}

export function createRealSession(opts: CreateRealSessionOptions): SnmpSession {
	const session = snmp.createSession(opts.host, opts.community, {
		port: opts.port,
		retries: opts.retries,
		timeout: opts.timeoutMs,
		version: snmp.Version2c,
	});

	return {
		async pollOnts(): Promise<RawOntRow[]> {
			// Hacemos walks paralelos por cada métrica y luego merge por index.
			// Usamos subtree (más predecible que tableColumns para OIDs de Huawei
			// donde las columnas están en subárboles distintos: 51.1.4, 62.1.22, etc.)
			const [
				statuses,
				rxPowers,
				txPowers,
				temps,
				distances,
				disconnects,
				serials,
				descriptions,
			] = await Promise.all([
				walkSubtree(session, fullOid(HUAWEI_OID.STATUS.subtree, HUAWEI_OID.STATUS.column)),
				walkSubtree(session, fullOid(HUAWEI_OID.RX_POWER.subtree, HUAWEI_OID.RX_POWER.column)),
				walkSubtree(session, fullOid(HUAWEI_OID.TX_POWER.subtree, HUAWEI_OID.TX_POWER.column)),
				walkSubtree(session, fullOid(HUAWEI_OID.TEMPERATURE.subtree, HUAWEI_OID.TEMPERATURE.column)),
				walkSubtree(session, fullOid(HUAWEI_OID.DISTANCE.subtree, HUAWEI_OID.DISTANCE.column)),
				walkSubtree(session, fullOid(HUAWEI_OID.LAST_DISCONNECT_REASON.subtree, HUAWEI_OID.LAST_DISCONNECT_REASON.column)),
				walkSubtree(session, fullOid(HUAWEI_OID.SERIAL.subtree, HUAWEI_OID.SERIAL.column)),
				walkSubtree(session, fullOid(HUAWEI_OID.DESCRIPTION.subtree, HUAWEI_OID.DESCRIPTION.column)),
			]);

			// Combinamos por index. Status es el atributo "ancla" — si una ONT
			// no aparece ahí, no la consideramos descubierta.
			const rows: RawOntRow[] = [];
			for (const [index, statusValue] of statuses) {
				const { oltPort, ontId } = splitIndex(index);
				if (!oltPort || !ontId) continue;

				const row: RawOntRow = {
					logicalId: index,
					oltPort,
					ontId,
					statusRaw: typeof statusValue === "number" ? statusValue : undefined,
				};

				const rx = rxPowers.get(index);
				if (typeof rx === "number") row.rxPowerRaw = rx;

				const tx = txPowers.get(index);
				if (typeof tx === "number") row.txPowerRaw = tx;

				const temp = temps.get(index);
				if (typeof temp === "number") row.temperatureRaw = temp;

				const dist = distances.get(index);
				if (typeof dist === "number") row.distanceM = dist;

				const reason = disconnects.get(index);
				if (typeof reason === "string") row.lastDisconnectReason = reason;
				else if (Buffer.isBuffer(reason)) row.lastDisconnectReason = reason.toString("utf8");

				const serial = serials.get(index);
				if (typeof serial === "string") row.serial = serial;
				else if (Buffer.isBuffer(serial)) row.serial = serial.toString("utf8");

				const description = descriptions.get(index);
				if (typeof description === "string") row.description = description;
				else if (Buffer.isBuffer(description))
					row.description = description.toString("utf8");

				rows.push(row);
			}

			return rows;
		},

		close() {
			session.close();
		},
	};
}
