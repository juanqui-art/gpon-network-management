"use client";

import { Toast as ToastPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function ToastProvider({
	swipeDirection = "right",
	...props
}: React.ComponentProps<typeof ToastPrimitive.Provider>) {
	return (
		<ToastPrimitive.Provider
			data-slot="toast-provider"
			swipeDirection={swipeDirection}
			{...props}
		/>
	);
}

function Toast({
	className,
	...props
}: React.ComponentProps<typeof ToastPrimitive.Root>) {
	return (
		<ToastPrimitive.Root
			data-slot="toast"
			className={cn(
				"grid gap-1 rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg data-[state=closed]:animate-out data-[state=open]:animate-in",
				className,
			)}
			{...props}
		/>
	);
}

function ToastTitle({
	className,
	...props
}: React.ComponentProps<typeof ToastPrimitive.Title>) {
	return (
		<ToastPrimitive.Title
			data-slot="toast-title"
			className={cn("text-sm font-medium", className)}
			{...props}
		/>
	);
}

function ToastDescription({
	className,
	...props
}: React.ComponentProps<typeof ToastPrimitive.Description>) {
	return (
		<ToastPrimitive.Description
			data-slot="toast-description"
			className={cn("text-xs text-muted-foreground", className)}
			{...props}
		/>
	);
}

function ToastViewport({
	className,
	...props
}: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
	return (
		<ToastPrimitive.Viewport
			data-slot="toast-viewport"
			className={cn(
				"fixed right-4 bottom-4 z-[60] flex max-h-screen w-[min(calc(100vw-2rem),22rem)] flex-col gap-2 outline-none",
				className,
			)}
			{...props}
		/>
	);
}

export { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport };
