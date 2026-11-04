import { create } from "zustand";

export interface ConfirmOptions {
	title: string;
	description?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: "default" | "danger";
	/**
	 * Optional third action (e.g. "Guardar y salir"). Resolves the dialog as
	 * confirmed when `run` returns true; keeps it open when it returns false.
	 */
	extraAction?: {
		label: string;
		pendingLabel?: string;
		run: () => Promise<boolean>;
	};
}

interface ConfirmRequest extends ConfirmOptions {
	resolve: (confirmed: boolean) => void;
}

export const useConfirmStore = create<{ request: ConfirmRequest | null }>(
	() => ({ request: null }),
);

/**
 * Promise-based confirmation rendered by <ConfirmHost />.
 * A new request cancels (resolves false) any pending one.
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
	return new Promise((resolve) => {
		useConfirmStore.getState().request?.resolve(false);
		useConfirmStore.setState({ request: { ...options, resolve } });
	});
}

export function settleConfirm(confirmed: boolean) {
	const { request } = useConfirmStore.getState();
	if (!request) return;
	useConfirmStore.setState({ request: null });
	request.resolve(confirmed);
}
