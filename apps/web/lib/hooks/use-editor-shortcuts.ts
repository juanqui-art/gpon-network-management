"use client";

import { useEffect } from "react";
import { isEditableTarget } from "@/lib/dom/is-editable-target";
import { isNavigationChordPending } from "@/lib/hooks/use-navigation-shortcuts";
import type { EditorMode } from "@/lib/store/network-editor";
import { useNetworkEditorStore } from "@/lib/store/network-editor";

/**
 * Single-key mode shortcuts for the network editor:
 *   v → view  |  d → design  |  e → edit (only if canEdit)
 * Skips when focus is inside an editable element, a modifier key is held, or
 * the key completes a global `g → x` navigation chord.
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
			if (isNavigationChordPending()) return;

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
