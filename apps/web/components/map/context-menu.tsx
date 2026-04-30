"use client";

import { Eye, Network } from "lucide-react";
import { useEffect, useRef } from "react";

interface ContextMenuPosition {
	x: number;
	y: number;
}

export interface ContextMenuOption {
	id: string;
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
}

interface ContextMenuProps {
	position: ContextMenuPosition | null;
	options: ContextMenuOption[];
	onClose: () => void;
}

export function ContextMenu({ position, options, onClose }: ContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!position) return;

		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleEscape);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [position, onClose]);

	if (!position) return null;

	return (
		<div
			ref={menuRef}
			className="fixed z-50 bg-[#27272a] border border-[#3f3f46] rounded-lg shadow-lg py-1 min-w-[180px]"
			style={{
				left: `${position.x}px`,
				top: `${position.y}px`,
			}}
		>
			{options.map((option) => (
				<button
					type="button"
					key={option.id}
					onClick={() => {
						option.onClick();
						onClose();
					}}
					className="w-full px-3 py-2 flex items-center gap-2 text-sm text-[#e6e6e6] hover:bg-[#3f3f46] transition-colors text-left"
				>
					<span className="text-[#a0a0a0] w-4 h-4 flex items-center justify-center">
						{option.icon}
					</span>
					{option.label}
				</button>
			))}
		</div>
	);
}

export const defaultContextMenuOptions = {
	viewDetails: {
		id: "view-details",
		label: "Ver detalles",
		icon: <Eye size={14} />,
	},
	viewDiagram: {
		id: "view-diagram",
		label: "Ver diagrama",
		icon: <Network size={14} />,
	},
};
