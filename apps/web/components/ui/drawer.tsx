"use client";

import type * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

function Drawer({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
	return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerPortal({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
	return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerOverlay({
	className,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
	return (
		<DrawerPrimitive.Overlay
			data-slot="drawer-overlay"
			className={cn(
				"fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in",
				className,
			)}
			{...props}
		/>
	);
}

function DrawerContent({
	className,
	children,
	showOverlay = true,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
	showOverlay?: boolean;
}) {
	return (
		<DrawerPortal>
			{showOverlay && <DrawerOverlay />}
			<DrawerPrimitive.Content
				data-slot="drawer-content"
				className={cn(
					"fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[rgba(164,164,164,0.16)] bg-[#222324] shadow-2xl outline-none",
					className,
				)}
				{...props}
			>
				{children}
			</DrawerPrimitive.Content>
		</DrawerPortal>
	);
}

function DrawerTitle({
	className,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
	return (
		<DrawerPrimitive.Title
			data-slot="drawer-title"
			className={cn("font-semibold leading-none", className)}
			{...props}
		/>
	);
}

function DrawerDescription({
	className,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
	return (
		<DrawerPrimitive.Description
			data-slot="drawer-description"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

export {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerOverlay,
	DrawerPortal,
	DrawerTitle,
};
