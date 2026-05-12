import type { ReactNode } from "react";
import { AppDrawer } from "@/components/ui/app-drawer";

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
			className="md:w-80 bg-[rgba(28,29,30,0.72)] text-[#d7d7d7] backdrop-blur-xl"
			contentClassName="space-y-3"
			footer={actions}
		>
			<div className="space-y-3">{children}</div>
		</AppDrawer>
	);
}
