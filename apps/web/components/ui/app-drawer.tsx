"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Drawer } from "vaul";
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
	contentClassName?: string;
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
	contentClassName,
	size = "md",
}: AppDrawerProps) {
	const [direction, setDirection] = useState<"bottom" | "right">("bottom");

	useEffect(() => {
		const mediaQuery = window.matchMedia("(min-width: 768px)");
		const updateDirection = () => {
			setDirection(mediaQuery.matches ? "right" : "bottom");
		};

		updateDirection();
		mediaQuery.addEventListener("change", updateDirection);
		return () => mediaQuery.removeEventListener("change", updateDirection);
	}, []);

	return (
		<Drawer.Root open={open} onOpenChange={onOpenChange} direction={direction}>
			<Drawer.Portal>
				<Drawer.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px]" />
				<Drawer.Content
					className={cn(
						"fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[rgba(164,164,164,0.16)] bg-[#222324] shadow-2xl outline-none",
						size === "md" &&
							"md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:max-h-none md:w-[min(32rem,calc(100vw-2rem))] md:rounded-2xl",
						size === "lg" &&
							"md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:max-h-none md:w-[min(38rem,calc(100vw-2rem))] md:rounded-2xl",
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
							<Drawer.Title className="truncate text-base font-semibold text-[#e6e6e6]">
								{title}
							</Drawer.Title>
							{description && (
								<Drawer.Description className="mt-1 text-sm leading-6 text-[#a4a4a4]">
									{description}
								</Drawer.Description>
							)}
						</div>
						<button
							type="button"
							aria-label="Cerrar panel"
							onClick={() => onOpenChange(false)}
							className="rounded-md p-1 text-[#777879] transition-colors hover:bg-[rgba(164,164,164,0.08)] hover:text-[#e6e6e6]"
						>
							<X className="size-4" />
						</button>
					</header>
					<div
						key={`${title}-${description ?? ""}`}
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
				</Drawer.Content>
			</Drawer.Portal>
		</Drawer.Root>
	);
}
