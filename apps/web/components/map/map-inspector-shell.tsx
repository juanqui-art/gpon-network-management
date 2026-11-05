import type { ReactNode } from "react";
import { useMapPanelContainer } from "@/components/map/map-panel-container";
import { AppDrawer } from "@/components/ui/app-drawer";
import { useIsDesktop } from "@/lib/hooks/use-media-query";

interface MapInspectorShellProps {
	accent: string;
	actions?: ReactNode;
	children: ReactNode;
	onClose: () => void;
	subtitle: string;
	title: string;
}

export function MapInspectorShell({
	accent,
	actions,
	children,
	onClose,
	subtitle,
	title,
}: MapInspectorShellProps) {
	const isDesktop = useIsDesktop();
	const container = useMapPanelContainer();

	// Desktop: docked, non-modal — the map stays clickable so another feature
	// can be selected (or dragged in edit mode) without closing first.
	// Mobile: modal bottom sheet.
	return (
		<AppDrawer
			open
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose();
			}}
			title={title}
			description={subtitle}
			accent={accent}
			size="md"
			modal={!isDesktop}
			showOverlay={!isDesktop}
			container={container}
			className="md:w-80 bg-[rgba(28,29,30,0.72)] text-fg-soft backdrop-blur-xl"
			contentClassName="space-y-3"
			footer={actions}
		>
			<div className="space-y-3">{children}</div>
		</AppDrawer>
	);
}
