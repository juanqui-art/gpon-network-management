"use client";

import { useEffect, useState } from "react";
import { useNetworkEditorStore } from "@/lib/store/network-editor";

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	const tagName = target.tagName.toLowerCase();
	return (
		target.isContentEditable ||
		tagName === "input" ||
		tagName === "textarea" ||
		tagName === "select"
	);
}

export function useNetworkEditorHistoryShortcuts({
	enabled,
	onHistoryChange,
}: {
	enabled: boolean;
	onHistoryChange?: (message: string) => void;
}) {
	const [historyState, setHistoryState] = useState(() => {
		const temporal = useNetworkEditorStore.temporal.getState();
		return {
			canRedo: temporal.futureStates.length > 0,
			canUndo: temporal.pastStates.length > 0,
		};
	});

	useEffect(() => {
		const updateHistoryState = () => {
			const temporal = useNetworkEditorStore.temporal.getState();
			setHistoryState({
				canRedo: temporal.futureStates.length > 0,
				canUndo: temporal.pastStates.length > 0,
			});
		};
		updateHistoryState();
		return useNetworkEditorStore.temporal.subscribe(updateHistoryState);
	}, []);

	useEffect(() => {
		if (!enabled) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			const isModifierPressed = event.ctrlKey || event.metaKey;
			if (!isModifierPressed || isEditableTarget(event.target)) return;

			const key = event.key.toLowerCase();
			const temporal = useNetworkEditorStore.temporal.getState();
			const editorStore = useNetworkEditorStore.getState();

			if (key === "z" && !event.shiftKey) {
				if (temporal.pastStates.length === 0) return;
				event.preventDefault();
				temporal.undo();
				editorStore.deselect();
				editorStore.setActiveTool("select");
				onHistoryChange?.("Cambio revertido con Ctrl+Z.");
				return;
			}

			const shouldRedo = (key === "z" && event.shiftKey) || key === "y";
			if (!shouldRedo || temporal.futureStates.length === 0) return;
			event.preventDefault();
			temporal.redo();
			editorStore.deselect();
			editorStore.setActiveTool("select");
			onHistoryChange?.("Cambio restaurado.");
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [enabled, onHistoryChange]);

	return historyState;
}
