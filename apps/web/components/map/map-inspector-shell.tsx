import { X } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { INSPECTOR_VARIANTS, SPRING_SNAPPY } from "@/lib/motion/config";

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
		<motion.aside
			variants={INSPECTOR_VARIANTS}
			initial="hidden"
			animate="visible"
			exit="exit"
			transition={SPRING_SNAPPY}
			className="absolute bottom-4 right-4 top-4 z-20 flex w-80 flex-col overflow-hidden rounded-xl border border-white/9 bg-[rgba(28,29,30,0.72)] text-[#d7d7d7] shadow-(--shadow-lg) backdrop-blur-xl"
		>
			<div className="h-1 shrink-0" style={{ backgroundColor: accent }} />
			<header className="flex items-start justify-between gap-3 border-b border-[rgba(164,164,164,0.12)] px-4 py-3">
				<div className="min-w-0">
					<h2 className="truncate text-sm font-semibold text-foreground">
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
		</motion.aside>
	);
}
