import {
	Database,
	KeyRound,
	Map as MapIcon,
	ShieldCheck,
	SlidersHorizontal,
	UserCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireAdmin } from "@/lib/auth/permissions";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, USER_ROLES } from "@/lib/auth/roles";
import { env } from "@/lib/env";

export const metadata = { title: "Settings" };

function maskValue(value: string): string {
	if (value.length <= 12) return "Configurado";
	return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function StatusBadge({ enabled }: { enabled: boolean }) {
	return (
		<Badge
			variant="outline"
			className={
				enabled
					? "border-[var(--status-online)]/35 bg-[var(--status-online)]/10 text-[var(--status-online)]"
					: "border-[var(--severity-high)]/35 bg-[var(--severity-high)]/10 text-[var(--severity-high)]"
			}
		>
			{enabled ? "Activo" : "Pendiente"}
		</Badge>
	);
}

function SettingRow({
	label,
	value,
	description,
	enabled = true,
}: {
	label: string;
	value: string;
	description: string;
	enabled?: boolean;
}) {
	return (
		<div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/25 p-3">
			<div className="min-w-0">
				<p className="text-sm font-medium text-foreground">{label}</p>
				<p className="mt-1 text-xs leading-5 text-muted-foreground">
					{description}
				</p>
			</div>
			<div className="shrink-0 text-right">
				<StatusBadge enabled={enabled} />
				<p className="mt-2 font-mono text-[11px] text-muted-foreground">
					{value}
				</p>
			</div>
		</div>
	);
}

function PermissionDot({
	label,
	enabled,
}: {
	label: string;
	enabled: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
			<span className="text-muted-foreground">{label}</span>
			<span
				className={
					enabled
						? "size-2 rounded-full bg-[var(--status-online)]"
						: "size-2 rounded-full bg-[var(--status-offline)]"
				}
			/>
		</div>
	);
}

export default async function SettingsPage() {
	await requireAdmin();

	const supabaseReady = Boolean(env.supabaseUrl && env.supabasePublishableKey);
	const mapboxReady = Boolean(env.mapboxToken);
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
	const serviceRoleReady = Boolean(process.env.SUPABASE_SECRET_KEY);

	return (
		<div className="min-h-full bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section>
					<Badge variant="outline" className="mb-3 border-border bg-muted/60">
						<SlidersHorizontal className="mr-1 size-3" aria-hidden="true" />
						Configuración administrativa
					</Badge>
					<h1 className="text-2xl font-semibold text-foreground">Settings</h1>
					<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
						Estado de entorno, seguridad, roles y parámetros base del sistema
						GPON. Esta vista no expone secretos completos.
					</p>
				</section>

				<section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Database className="size-4" aria-hidden="true" />
								Entorno y servicios
							</CardTitle>
							<CardDescription>
								Variables críticas que habilitan auth, datos y mapa.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<SettingRow
								label="Supabase URL"
								value={maskValue(env.supabaseUrl)}
								description="Endpoint principal para Auth, PostgREST y Realtime."
								enabled={supabaseReady}
							/>
							<SettingRow
								label="Supabase publishable key"
								value={maskValue(env.supabasePublishableKey)}
								description="Clave pública usada por clientes browser y SSR."
								enabled={supabaseReady}
							/>
							<SettingRow
								label="Supabase service role"
								value={serviceRoleReady ? "Configurado" : "No configurado"}
								description="Necesaria para usuarios, roles, invitaciones y auditoría server-side."
								enabled={serviceRoleReady}
							/>
							<SettingRow
								label="Mapbox token"
								value={maskValue(env.mapboxToken)}
								description="Token requerido para renderizar el mapa operativo."
								enabled={mapboxReady}
							/>
							<SettingRow
								label="Site URL"
								value={siteUrl}
								description="Base para callbacks de recuperación e invitaciones."
								enabled={Boolean(siteUrl)}
							/>
						</CardContent>
					</Card>

					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ShieldCheck className="size-4" aria-hidden="true" />
								Seguridad
							</CardTitle>
							<CardDescription>
								Controles actuales y pendientes conocidos.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<PermissionDot label="RLS en tablas GPON" enabled />
							<PermissionDot label="Roles en app_metadata" enabled />
							<PermissionDot label="Auditoría administrativa" enabled />
							<PermissionDot
								label="Service role aislada en servidor"
								enabled={serviceRoleReady}
							/>
							<Separator />
							<div className="rounded-lg border border-[var(--severity-high)]/25 bg-[var(--severity-high)]/8 p-3">
								<p className="text-sm font-medium text-foreground">
									Pendientes de hardening
								</p>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									Revisar ejecución pública de RPCs, fijar search_path en
									funciones y activar leaked password protection en Supabase
									Auth.
								</p>
							</div>
						</CardContent>
					</Card>
				</section>

				<section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<UserCog className="size-4" aria-hidden="true" />
								Roles del sistema
							</CardTitle>
							<CardDescription>
								Modelo actual de permisos operativos.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							{USER_ROLES.map((role) => (
								<div
									key={role}
									className="rounded-lg border border-border bg-muted/25 p-3"
								>
									<p className="text-sm font-medium text-foreground">
										{ROLE_LABELS[role]}
									</p>
									<p className="mt-1 text-xs leading-5 text-muted-foreground">
										{ROLE_DESCRIPTIONS[role]}
									</p>
								</div>
							))}
						</CardContent>
					</Card>

					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<MapIcon className="size-4" aria-hidden="true" />
								Parámetros operativos
							</CardTitle>
							<CardDescription>
								Valores base usados por mapa, auth y consola.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-3 md:grid-cols-2">
							<div className="rounded-lg border border-border bg-muted/25 p-3">
								<p className="flex items-center gap-2 text-sm font-medium text-foreground">
									<KeyRound className="size-4 text-[var(--gpon-olt)]" />
									Callbacks
								</p>
								<p className="mt-2 text-xs leading-5 text-muted-foreground">
									Invitaciones y reset de contraseña redirigen hacia el callback
									de Auth y luego a `/reset-password`.
								</p>
							</div>
							<div className="rounded-lg border border-border bg-muted/25 p-3">
								<p className="flex items-center gap-2 text-sm font-medium text-foreground">
									<ShieldCheck className="size-4 text-[var(--gpon-ont)]" />
									Acceso admin
								</p>
								<p className="mt-2 text-xs leading-5 text-muted-foreground">
									Las páginas `/admin/*` usan validación server-side con
									`requireAdmin`.
								</p>
							</div>
							<div className="rounded-lg border border-border bg-muted/25 p-3">
								<p className="text-sm font-medium text-foreground">
									Base visual
								</p>
								<p className="mt-2 text-xs leading-5 text-muted-foreground">
									Dark mode operativo, shadcn/ui y tokens GPON centralizados en
									`globals.css`.
								</p>
							</div>
							<div className="rounded-lg border border-border bg-muted/25 p-3">
								<p className="text-sm font-medium text-foreground">Auditoría</p>
								<p className="mt-2 text-xs leading-5 text-muted-foreground">
									Acciones sensibles de usuarios se registran en `audit_logs`.
								</p>
							</div>
						</CardContent>
					</Card>
				</section>
			</div>
		</div>
	);
}
