"use client";

import { X } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface AppDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	children: ReactNode;
	footer?: ReactNode;
	accent?: string;
	className?: string;
	direction?: "bottom" | "left" | "right";
	contentClassName?: string;
	dismissible?: boolean;
	modal?: boolean;
	showOverlay?: boolean;
	showClose?: boolean;
	style?: CSSProperties;
	size?: "md" | "lg";
}

export function AppDrawer({
	open,
	onOpenChange,
	title,
	description,
	children,
	footer,
	accent,
	className,
	direction,
	contentClassName,
	dismissible = true,
	modal = true,
	showOverlay = true,
	showClose = true,
	style,
	size = "md",
}: AppDrawerProps) {
	const [responsiveDirection, setResponsiveDirection] = useState<
		"bottom" | "right"
	>(() => {
		if (typeof window === "undefined") return "bottom";
		return window.matchMedia("(min-width: 768px)").matches ? "right" : "bottom";
	});

	useEffect(() => {
		if (direction) return;
		const mediaQuery = window.matchMedia("(min-width: 768px)");
		const updateDirection = () => {
			setResponsiveDirection(mediaQuery.matches ? "right" : "bottom");
		};

		updateDirection();
		mediaQuery.addEventListener("change", updateDirection);
		return () => mediaQuery.removeEventListener("change", updateDirection);
	}, [direction]);

	const effectiveDirection = direction ?? responsiveDirection;
	const desktopPlacement =
		effectiveDirection === "left"
			? "md:inset-x-auto md:bottom-4 md:left-4 md:top-4"
			: effectiveDirection === "bottom"
				? "md:inset-x-0 md:bottom-0 md:left-0 md:right-0 md:top-auto"
				: "md:inset-x-auto md:bottom-4 md:right-4 md:top-4";

	return (
		<Drawer
			open={open}
			onOpenChange={onOpenChange}
			direction={effectiveDirection}
			dismissible={dismissible}
			modal={modal}
		>
			<DrawerContent
				showOverlay={showOverlay}
				style={style}
				className={cn(
					desktopPlacement,
					"md:max-h-none md:rounded-2xl",
					effectiveDirection === "left" && "md:w-[min(32rem,calc(100vw-2rem))]",
					effectiveDirection === "bottom" &&
						"md:mx-0 md:w-full md:max-w-none md:rounded-t-2xl md:rounded-b-none",
					effectiveDirection !== "bottom" &&
						size === "md" &&
						"md:w-[min(32rem,calc(100vw-2rem))]",
					effectiveDirection !== "bottom" &&
						size === "lg" &&
						"md:w-[min(38rem,calc(100vw-2rem))]",
					className,
				)}
			>
				{accent && (
					<div
						className="hidden h-1 shrink-0 md:block"
						style={{ backgroundColor: accent }}
					/>
				)}
				<div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-white/20 md:hidden" />
				<header className="flex shrink-0 items-start justify-between gap-3 border-b border-[rgba(164,164,164,0.12)] px-5 py-4">
					<div className="min-w-0">
						<DrawerTitle className="truncate text-base font-semibold text-[#e6e6e6]">
							{title}
						</DrawerTitle>
						{description && (
							<DrawerDescription className="mt-1 text-sm leading-6 text-[#a4a4a4]">
								{description}
							</DrawerDescription>
						)}
					</div>
					{showClose && (
						<button
							type="button"
							aria-label="Cerrar panel"
							onClick={() => onOpenChange(false)}
							className="rounded-md p-1 text-[#777879] transition-colors hover:bg-[rgba(164,164,164,0.08)] hover:text-[#e6e6e6]"
						>
							<X className="size-4" />
						</button>
					)}
				</header>
				<div
					data-vaul-no-drag
					className={cn(
						"min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 py-4",
						contentClassName,
					)}
				>
					{children}
				</div>
				{footer && (
					<footer className="shrink-0 border-t border-[rgba(164,164,164,0.12)] px-5 py-4">
						{footer}
					</footer>
				)}
			</DrawerContent>
		</Drawer>
	);
}
