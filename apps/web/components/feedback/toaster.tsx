"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import {
	Toast,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "@/components/ui/toast";
import {
	dismissToast,
	type ToastTone,
	useToastStore,
} from "@/lib/feedback/toast";
import { cn } from "@/lib/utils";

const TONE_STYLE: Record<ToastTone, { icon: typeof Info; className: string }> =
	{
		success: {
			icon: CheckCircle2,
			className: "border-l-success [&_svg]:text-success",
		},
		error: {
			icon: AlertTriangle,
			className: "border-l-danger [&_svg]:text-danger",
		},
		info: {
			icon: Info,
			className: "border-l-info [&_svg]:text-info",
		},
	};

export function Toaster() {
	const toasts = useToastStore((state) => state.toasts);

	return (
		<ToastProvider duration={5000} label="Notificaciones">
			{toasts.map((item) => {
				const tone = TONE_STYLE[item.tone];
				const Icon = tone.icon;
				return (
					<Toast
						key={item.id}
						type={item.tone === "error" ? "foreground" : "background"}
						duration={item.duration ?? (item.tone === "error" ? 8000 : 5000)}
						onOpenChange={(open) => {
							if (!open) dismissToast(item.id);
						}}
						className={cn(
							"relative grid-cols-[auto_1fr] items-start gap-x-2.5 border-l-4 py-2.5 pr-9 pl-3",
							tone.className,
						)}
					>
						<Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
						<div className="min-w-0 space-y-0.5">
							<ToastTitle>{item.title}</ToastTitle>
							{item.description && (
								<ToastDescription className="text-fg-secondary">
									{item.description}
								</ToastDescription>
							)}
						</div>
						<ToastPrimitive.Close
							aria-label="Cerrar notificación"
							className="absolute top-2 right-2 rounded p-1 text-fg-secondary transition-colors hover:bg-muted hover:text-foreground"
						>
							<X className="size-3.5 !text-current" aria-hidden="true" />
						</ToastPrimitive.Close>
					</Toast>
				);
			})}
			<ToastViewport />
		</ToastProvider>
	);
}
