import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
	id: number;
	title: string;
	description?: string;
	tone: ToastTone;
	/** ms; defaults to 5s (8s for errors). */
	duration?: number;
}

const MAX_VISIBLE = 4;

export const useToastStore = create<{ toasts: ToastItem[] }>(() => ({
	toasts: [],
}));

let sequence = 0;

/** Fire-and-forget notification, callable from anywhere (components, stores). */
export function toast(input: Omit<ToastItem, "id">): number {
	sequence += 1;
	const id = sequence;
	useToastStore.setState((state) => ({
		toasts: [...state.toasts.slice(-(MAX_VISIBLE - 1)), { ...input, id }],
	}));
	return id;
}

export function dismissToast(id: number) {
	useToastStore.setState((state) => ({
		toasts: state.toasts.filter((item) => item.id !== id),
	}));
}
