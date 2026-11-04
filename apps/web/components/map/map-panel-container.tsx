"use client";

import { createContext, useContext } from "react";
import { useIsDesktop } from "@/lib/hooks/use-media-query";

/**
 * Element that docked (desktop) map panels portal into: an empty layer over
 * the map (<MapPanelHost />). Its `transform` makes it the containing block of
 * `position: fixed` descendants, so panels anchor to the map area instead of
 * the viewport and never cover the app nav or the editor topbar.
 */
export const MapPanelContainerContext = createContext<HTMLElement | null>(null);

/** Portal target for a docked panel, or null on mobile (sheets use <body>). */
export function useMapPanelContainer(): HTMLElement | null {
	const container = useContext(MapPanelContainerContext);
	const isDesktop = useIsDesktop();
	return isDesktop ? container : null;
}

/**
 * Click-through layer over the map. Panels portaled here must opt back into
 * pointer events (AppDrawer does it when given a container).
 */
export function MapPanelHost({
	onHost,
}: {
	onHost: (element: HTMLDivElement | null) => void;
}) {
	return (
		<div
			ref={onHost}
			aria-hidden={false}
			className="pointer-events-none absolute inset-0 z-40 [transform:translateZ(0)]"
		/>
	);
}
