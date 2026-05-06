import { X } from "lucide-react";
import type { ReactNode } from "react";

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
		<aside className="absolute bottom-4 right-4 top-4 z-20 flex w-80 flex-col overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] text-[#d7d7d7] shadow-2xl backdrop-blur-md">
			<div className="h-1 shrink-0" style={{ backgroundColor: accent }} />
			<header className="flex items-start justify-between gap-3 border-b border-[rgba(164,164,164,0.12)] px-4 py-3">
				<div className="min-w-0">
					<h2 className="truncate text-sm font-semibold text-[#e6e6e6]">
						{title}
					</h2>
					<p className="mt-0.5 text-xs text-[#777879]">{subtitle}</p>
				</div>
				<button
					type="button"
					aria-label="Cerrar inspector"
					onClick={onClose}
					className="rounded-md p-1 text-[#777879] transition-colors hover:bg-[rgba(164,164,164,0.08)] hover:text-[#e6e6e6]"
				>
					<X className="size-4" />
				</button>
			</header>
			<div className="min-h-0 flex-1 overflow-y-auto p-4 pr-5">
				<div className="space-y-3">
					{children}
					{actions}
				</div>
			</div>
		</aside>
	);
}
