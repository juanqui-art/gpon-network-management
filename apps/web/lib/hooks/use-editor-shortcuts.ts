"use client";

import { useEffect } from "react";
import type { EditorMode } from "@/lib/store/network-editor";
import { useNetworkEditorStore } from "@/lib/store/network-editor";

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName.toLowerCase();
	return (
		target.isContentEditable ||
		tag === "input" ||
		tag === "textarea" ||
		tag === "select"
	);
}

/**
 * Single-key mode shortcuts for the network editor:
 *   v → view  |  d → design  |  e → edit (only if canEdit)
 * Skips when focus is inside an editable element or a modifier key is held.
 */
export function useEditorShortcuts({
	canEdit,
	onModeChange,
}: {
	canEdit: boolean;
	onModeChange?: (mode: EditorMode) => void;
}) {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey) return;
			if (isEditableTarget(event.target)) return;

			const { setMode, setActiveTool, deselect } =
				useNetworkEditorStore.getState();

			let next: EditorMode | null = null;
			if (event.key === "v") next = "view";
			else if (event.key === "d") next = "design";
			else if (event.key === "e" && canEdit) next = "edit";

			if (!next) return;
			event.preventDefault();
			setMode(next);
			setActiveTool("select");
			deselect();
			onModeChange?.(next);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [canEdit, onModeChange]);
}
