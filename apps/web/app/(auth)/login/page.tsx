"use client";

import {
	Activity,
	ArrowRight,
	LockKeyhole,
	Mail,
	RadioTower,
} from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
	const [error, action, pending] = useActionState(signIn, null);

	return (
		<div className="space-y-7">
			<div className="space-y-5">
				<div className="flex items-center justify-between gap-4">
					<div className="flex size-11 items-center justify-center rounded-lg border border-border bg-muted/70 text-primary shadow-lg shadow-black/20">
						<RadioTower className="size-5" aria-hidden="true" />
					</div>
					<div className="flex items-center gap-2 rounded-full border border-border bg-muted/45 px-3 py-1 text-[11px] font-medium text-muted-foreground">
						<span className="size-1.5 rounded-full bg-[var(--status-online)] shadow-[0_0_12px_var(--status-online)]" />
						NOC activo
					</div>
				</div>

				<div>
					<p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
						Acceso seguro
					</p>
					<h1 className="text-2xl font-semibold text-foreground">
						GPON Network
					</h1>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						Ingresa al panel para supervisar la red, revisar eventos y gestionar
						infraestructura.
					</p>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<div className="rounded-lg border border-border bg-muted/35 px-3 py-2">
						<div className="flex items-center gap-2 text-xs font-medium text-foreground">
							<Activity className="size-3.5 text-[var(--gpon-ont)]" />
							Monitoreo
						</div>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Tiempo real
						</p>
					</div>
					<div className="rounded-lg border border-border bg-muted/35 px-3 py-2">
						<div className="flex items-center gap-2 text-xs font-medium text-foreground">
							<LockKeyhole className="size-3.5 text-[var(--gpon-olt)]" />
							Roles
						</div>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Controlados
						</p>
					</div>
				</div>
			</div>

			<form action={action} className="space-y-5">
				<div className="space-y-2">
					<Label htmlFor="email" className="text-foreground">
						Email
					</Label>
					<div className="relative">
						<Mail
							className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							id="email"
							name="email"
							type="email"
							required
							autoComplete="email"
							placeholder="usuario@empresa.ec"
							className="h-11 border-border bg-muted/45 pr-3 pl-9 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/25"
						/>
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-3">
						<Label htmlFor="password" className="text-foreground">
							Contraseña
						</Label>
						<Link
							href="/forgot-password"
							className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
						>
							¿Olvidaste tu contraseña?
						</Link>
					</div>
					<div className="relative">
						<LockKeyhole
							className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							id="password"
							name="password"
							type="password"
							required
							autoComplete="current-password"
							className="h-11 border-border bg-muted/45 pr-3 pl-9 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/25"
						/>
					</div>
				</div>

				{error && (
					<div
						className="rounded-lg border border-[var(--status-alarm)]/35 bg-[var(--status-alarm)]/10 px-3 py-2.5 text-sm text-[#ffb3c1]"
						role="alert"
					>
						{error}
					</div>
				)}

				<Button type="submit" disabled={pending} className="h-11 w-full gap-2">
					{pending ? (
						"Validando acceso..."
					) : (
						<>
							Ingresar
							<ArrowRight className="size-4" aria-hidden="true" />
						</>
					)}
				</Button>
			</form>

			<div className="border-t border-border pt-5 text-center text-sm text-muted-foreground">
				¿No tienes cuenta? Pide a un administrador que te envíe una invitación.
			</div>
		</div>
	);
}
