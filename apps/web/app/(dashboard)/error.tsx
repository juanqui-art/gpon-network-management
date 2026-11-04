"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { RouteStateFrame } from "@/components/feedback/route-states";
import { Button } from "@/components/ui/button";

export default function DashboardError({
	error,
	unstable_retry,
}: {
	error: Error & { digest?: string };
	unstable_retry: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<RouteStateFrame>
			<AlertTriangle
				className="mx-auto size-8 text-[var(--status-alarm)]"
				aria-hidden="true"
			/>
			<h1 className="mt-4 text-lg font-semibold text-foreground">
				Algo salió mal al cargar esta sección
			</h1>
			<p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
				Puede ser un problema temporal de conexión con el servidor. Inténtalo de
				nuevo; si persiste, comparte el código de referencia con soporte.
			</p>
			{error.digest && (
				<p className="mt-3 font-mono text-xs text-[var(--text-secondary)]">
					Ref: {error.digest}
				</p>
			)}
			<div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
				<Button
					type="button"
					variant="accent"
					onClick={() => unstable_retry()}
					className="gap-1.5"
				>
					<RotateCw aria-hidden="true" />
					Reintentar
				</Button>
				<Link
					href="/networks"
					className="inline-flex h-8 items-center justify-center rounded-lg px-4 text-sm text-[var(--text-secondary)] transition-colors hover:bg-muted hover:text-foreground"
				>
					Ir a Redes
				</Link>
			</div>
		</RouteStateFrame>
	);
}
