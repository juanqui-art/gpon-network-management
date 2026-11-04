"use client";

import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
	isPending: boolean;
	isError: boolean;
	isRefetching?: boolean;
	onRetry: () => void;
}

/**
 * Loading / error overlay for map screens. While pending it blocks the map so
 * an empty canvas is never mistaken for an empty network.
 */
export function NetworkLoadState({
	isPending,
	isError,
	isRefetching,
	onRetry,
}: Props) {
	if (isError) {
		return (
			<div
				role="alert"
				className="absolute top-16 left-1/2 z-30 flex w-[min(calc(100%-2rem),26rem)] -translate-x-1/2 items-start gap-3 rounded-lg border border-danger/35 bg-surface-panel px-4 py-3 text-sm shadow-xl"
			>
				<AlertTriangle
					className="mt-0.5 size-4 shrink-0 text-danger"
					aria-hidden="true"
				/>
				<div className="min-w-0 flex-1">
					<p className="font-medium text-foreground">
						No se pudo cargar la red
					</p>
					<p className="mt-0.5 text-xs text-fg-secondary">
						Revisa tu conexión e inténtalo de nuevo. Lo que ves en el mapa puede
						estar incompleto.
					</p>
				</div>
				<Button
					type="button"
					size="sm"
					variant="secondary"
					onClick={onRetry}
					disabled={isRefetching}
					className="gap-1.5"
				>
					<RotateCw
						className={isRefetching ? "animate-spin" : undefined}
						aria-hidden="true"
					/>
					Reintentar
				</Button>
			</div>
		);
	}

	if (!isPending) return null;

	return (
		<div
			role="status"
			aria-live="polite"
			className="absolute inset-0 z-30 flex items-center justify-center bg-surface/70 backdrop-blur-[2px]"
		>
			<div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-panel px-4 py-2.5 text-sm text-fg-secondary shadow-xl">
				<Loader2 className="size-4 animate-spin text-info" aria-hidden="true" />
				Cargando red…
			</div>
		</div>
	);
}
