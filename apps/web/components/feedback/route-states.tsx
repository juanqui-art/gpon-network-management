import { Compass, Loader2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Shared fallback layout for loading / error / not-found route files. */
export function RouteStateFrame({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-full min-h-[60dvh] items-center justify-center p-6">
			<div className="w-full max-w-md rounded-xl border border-border bg-card px-6 py-8 text-center shadow-[var(--shadow-md)]">
				{children}
			</div>
		</div>
	);
}

export function RouteLoading({ label = "Cargando…" }: { label?: string }) {
	return (
		<div
			role="status"
			aria-live="polite"
			className="flex h-full min-h-[60dvh] items-center justify-center gap-2.5 text-sm text-[var(--text-secondary)]"
		>
			<Loader2
				className="size-4 animate-spin text-[var(--gpon-olt)]"
				aria-hidden="true"
			/>
			{label}
		</div>
	);
}

export function RouteNotFound() {
	return (
		<RouteStateFrame>
			<Compass
				className="mx-auto size-8 text-[var(--text-secondary)]"
				aria-hidden="true"
			/>
			<h1 className="mt-4 text-lg font-semibold text-foreground">
				Página no disponible
			</h1>
			<p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
				La página no existe, fue archivada o tu rol no tiene acceso a ella. Si
				crees que es un error, pide acceso a un administrador.
			</p>
			<div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
				<Link
					href="/networks"
					className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--accent-brand)] px-4 text-sm font-medium text-[#0b1220] transition-colors hover:bg-[var(--accent-brand-hover)]"
				>
					Ir a Redes
				</Link>
				<Link
					href="/dashboard"
					className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm text-[var(--text-secondary)] transition-colors hover:bg-muted hover:text-foreground"
				>
					Ir al inicio
				</Link>
			</div>
		</RouteStateFrame>
	);
}
