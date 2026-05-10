declare module "net-snmp" {
	enum Version {
		Version1 = 0,
		Version2c = 1,
		Version3 = 3,
	}

	interface SessionOptions {
		port?: number;
		retries?: number;
		timeout?: number;
		version?: Version;
		engineID?: string;
		contextName?: string;
		contextEngineID?: string;
		user?: string;
		authProtocol?: string;
		authKey?: string;
		privProtocol?: string;
		privKey?: string;
	}

	interface Varbind {
		oid: string;
		type?: number;
		value?: unknown;
	}

	function isVarbindError(varbind: Varbind): boolean;

	function createSession(
		host: string,
		community: string,
		options?: SessionOptions,
	): Session;

	class Session {
		close(): void;

		get(
			oids: string[],
			callback: (error: Error | null, varbinds: Varbind[]) => void,
		): void;

		getNext(
			oids: string[],
			callback: (error: Error | null, varbinds: Varbind[]) => void,
		): void;

		getBulk(
			nonRepeaters: number,
			maxRepetitions: number,
			oids: string[],
			callback: (error: Error | null, varbinds: Varbind[]) => void,
		): void;

		walk(
			oid: string,
			maxRepetitions: number,
			feedCallback: (varbinds: Varbind[]) => void,
			doneCallback: (error: Error | null) => void,
		): void;

		subtree(
			oid: string,
			maxRepetitions: number,
			feedCallback: (varbinds: Varbind[]) => void,
			doneCallback: (error: Error | null) => void,
		): void;

		tableColumns(
			oid: string,
			columns: number[],
			maxRepetitions: number,
			callback: (
				error: Error | null,
				table: Record<string, Record<number, unknown>>,
			) => void,
		): void;

		set(
			varbinds: Varbind[],
			callback: (error: Error | null, varbinds: Varbind[]) => void,
		): void;

		trap(
			typeOrOid: string | number,
			varbinds: Varbind[],
			callback?: (error: Error | null) => void,
		): void;

		informRequest(
			varbinds: Varbind[],
			callback: (error: Error | null, varbinds: Varbind[]) => void,
		): void;
	}

	export {
		Session,
		SessionOptions,
		Varbind,
		Version,
		Version1,
		Version2c,
		Version3,
		isVarbindError,
		createSession,
	};

	export const Version1: Version;
	export const Version2c: Version;
	export const Version3: Version;
}
