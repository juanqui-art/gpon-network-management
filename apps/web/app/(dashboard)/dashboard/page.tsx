import {
	Activity,
	AlertTriangle,
	ArrowRight,
	Cable,
	CheckCircle2,
	Clock3,
	FileClock,
	KeyRound,
	Map as MapIcon,
	Network,
	RadioTower,
	Route,
	Settings,
	ShieldCheck,
	SlidersHorizontal,
	Sparkles,
	Split,
	UserCircle,
	Users,
	Wifi,
} from "lucide-react";
import Link from "next/link";
import type {
	FiberRoute,
	InfrastructureElement,
	RoutePoint,
} from "@/components/map/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getUserRoleFromMetadata, ROLE_LABELS } from "@/lib/auth/roles";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
	canDeleteInfrastructure,
	canWriteInfrastructure,
	type DataQuality,
	type ElementStatus,
	type ElementType,
	type RouteStatus,
	type UserRole,
} from "@/lib/types/gpon";
import type { NetworkSummary } from "@/lib/types/network";

export const metadata = { title: "Dashboard administrador" };

const roleScopeLabels: Record<UserRole, string> = {
	admin: "Acceso completo",
	network_engineer: "Gestión técnica",
	outside_plant: "Operación de campo",
	installer: "Instalación",
	support: "Soporte y lectura",
};

const roleDescriptions: Record<UserRole, string> = {
	admin:
		"Puede gestionar usuarios, roles, red, auditoría y acciones destructivas.",
	network_engineer: "Puede diseñar y editar infraestructura de red.",
	outside_plant: "Puede revisar información de campo y calidad geográfica.",
	installer: "Puede consultar tareas e información operativa asignada.",
	support: "Puede consultar la operación y apoyar seguimiento de incidencias.",
};

const elementLabels: Record<ElementType, string> = {
	olt: "OLT",
	splitter: "Splitters",
	nap: "NAPs",
};

const statusLabels: Record<ElementStatus | RouteStatus, string> = {
	active: "Activos",
	damaged: "Dañados",
	faulty: "Con falla",
	inactive: "Inactivos",
	installed: "Instalados",
	planned: "Planificados",
	retired: "Retirados",
};

const qualityLabels: Record<DataQuality, string> = {
	unknown: "Sin clasificar",
	approximate: "Aproximada",
	drawn: "Dibujada",
	gps_captured: "GPS",
	verified: "Verificada",
};

function formatNumber(value: number): string {
	return new Intl.NumberFormat("es-EC").format(value);
}

function formatKm(meters: number): string {
	return `${new Intl.NumberFormat("es-EC", {
		maximumFractionDigits: 1,
	}).format(meters / 1000)} km`;
}

function formatDate(value: string | null | undefined): string {
	if (!value) return "Sin registro";
	return new Intl.DateTimeFormat("es-EC", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function getInitials(email: string): string {
	return email.slice(0, 2).toUpperCase();
}

function percent(value: number, total: number): number {
	if (total === 0) return 0;
	return Math.round((value / total) * 100);
}

function countBy<TItem, TValue extends string>(
	items: TItem[],
	key: keyof TItem,
	values: readonly TValue[],
): Record<TValue, number> {
	return values.reduce(
		(acc, value) => {
			acc[value] = items.filter((item) => item[key] === value).length;
			return acc;
		},
		{} as Record<TValue, number>,
	);
}

function ProgressLine({
	label,
	value,
	total,
	tone = "neutral",
}: {
	label: string;
	value: number;
	total: number;
	tone?: "neutral" | "good" | "warn";
}) {
	const width = percent(value, total);
	const color =
		tone === "good"
			? "bg-[var(--status-online)]"
			: tone === "warn"
				? "bg-[var(--severity-high)]"
				: "bg-primary";

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-3 text-xs">
				<span className="text-muted-foreground">{label}</span>
				<span className="font-mono text-foreground">{formatNumber(value)}</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-muted">
				<div
					className={`h-full rounded-full ${color}`}
					style={{ width: `${width}%` }}
				/>
			</div>
		</div>
	);
}

function MetricCard({
	title,
	value,
	description,
	icon: Icon,
	tone,
}: {
	title: string;
	value: string;
	description: string;
	icon: typeof Activity;
	tone: string;
}) {
	return (
		<Card className="rounded-lg border-border/80 bg-card/80">
			<CardHeader className="flex-row items-center justify-between gap-3">
				<div>
					<CardDescription>{title}</CardDescription>
					<CardTitle className="mt-2 text-2xl">{value}</CardTitle>
				</div>
				<div
					className={`flex size-10 items-center justify-center rounded-lg border ${tone}`}
				>
					<Icon className="size-5" aria-hidden="true" />
				</div>
			</CardHeader>
			<CardContent>
				<p className="text-xs text-muted-foreground">{description}</p>
			</CardContent>
		</Card>
	);
}

function PermissionPill({
	label,
	enabled,
}: {
	label: string;
	enabled: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2 text-sm">
			<span className="text-muted-foreground">{label}</span>
			<Badge
				variant="outline"
				className={
					enabled
						? "border-[var(--status-online)]/35 bg-[var(--status-online)]/10 text-[var(--status-online)]"
						: "border-border bg-muted/40 text-muted-foreground"
				}
			>
				{enabled ? "Permitido" : "Restringido"}
			</Badge>
		</div>
	);
}

function SettingStatus({
	label,
	enabled,
	description,
}: {
	label: string;
	enabled: boolean;
	description: string;
}) {
	return (
		<div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/25 p-3">
			<div>
				<p className="text-sm font-medium text-foreground">{label}</p>
				<p className="mt-1 text-xs leading-5 text-muted-foreground">
					{description}
				</p>
			</div>
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
		</div>
	);
}

export default async function AdminDashboardPage() {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const role = getUserRoleFromMetadata(
		user?.app_metadata as Record<string, unknown> | null | undefined,
		user?.user_metadata as Record<string, unknown> | null | undefined,
	);
	const userEmail = user?.email ?? "usuario@sin-email";
	const mapboxReady = Boolean(env.mapboxToken);
	const supabaseReady = Boolean(env.supabaseUrl && env.supabasePublishableKey);
	const canManageUsers = role === "admin";
	const canWriteNetwork = canWriteInfrastructure(role);
	const canDeleteNetwork = canDeleteInfrastructure(role);

	const [
		{ data: networks },
		{ data: elements },
		{ data: routes },
		{ data: routePoints },
	] = await Promise.all([
		supabase.rpc("list_networks"),
		supabase.rpc("infrastructure_elements_for_map"),
		supabase.rpc("fiber_routes_for_map"),
		supabase.rpc("route_points_for_map"),
	]);

	const networkRows = (networks ?? []) as NetworkSummary[];
	const elementRows = (elements ?? []) as InfrastructureElement[];
	const routeRows = (routes ?? []) as FiberRoute[];
	const routePointRows = (routePoints ?? []) as RoutePoint[];

	const elementCounts = countBy<InfrastructureElement, ElementType>(
		elementRows,
		"type",
		["olt", "splitter", "nap"],
	);
	const elementStatusCounts = countBy<InfrastructureElement, ElementStatus>(
		elementRows,
		"status",
		["planned", "active", "inactive", "faulty", "retired"],
	);
	const routeStatusCounts = countBy<FiberRoute, RouteStatus>(
		routeRows,
		"status",
		["planned", "installed", "active", "damaged", "retired"],
	);
	const qualityCounts = countBy<InfrastructureElement, DataQuality>(
		elementRows,
		"location_quality",
		["unknown", "approximate", "drawn", "gps_captured", "verified"],
	);

	const totalFiberMeters = routeRows.reduce(
		(total, route) => total + (route.length_meters ?? 0),
		0,
	);
	const totalNapPorts = elementRows.reduce(
		(total, element) => total + (element.total_ports ?? 0),
		0,
	);
	const usedNapPorts = elementRows.reduce(
		(total, element) => total + (element.ports_used ?? 0),
		0,
	);
	const operationalElements =
		elementStatusCounts.active + elementStatusCounts.planned;
	const riskRoutePoints = routePointRows.filter(
		(point) => point.risk_level === "high" || point.risk_level === "critical",
	).length;
	const damagedRoutes = routeStatusCounts.damaged;
	const activePercent = percent(operationalElements, elementRows.length);
	const portUsePercent = percent(usedNapPorts, totalNapPorts);
	const verifiedPercent = percent(qualityCounts.verified, elementRows.length);

	const recentNetworks = [...networkRows]
		.sort(
			(a, b) =>
				new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
		)
		.slice(0, 4);

	return (
		<div className="min-h-full bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<div className="mb-3 flex items-center gap-2">
							<Badge variant="outline" className="border-border bg-muted/60">
								<ShieldCheck className="mr-1 size-3" aria-hidden="true" />
								{ROLE_LABELS[role]}
							</Badge>
							<Badge className="bg-[var(--status-online)]/16 text-[var(--status-online)]">
								NOC en línea
							</Badge>
						</div>
						<h1 className="text-2xl font-semibold text-foreground">
							Dashboard administrador
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
							Vista ejecutiva para controlar cobertura, capacidad, calidad de
							datos y riesgos operativos de la red GPON.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button asChild variant="outline">
							<Link href="/networks">
								<Network className="size-4" aria-hidden="true" />
								Gestionar redes
							</Link>
						</Button>
						<Button asChild>
							<Link href="/map">
								<MapIcon className="size-4" aria-hidden="true" />
								Abrir mapa
							</Link>
						</Button>
					</div>
				</section>

				<section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader className="flex-row items-start justify-between gap-4">
							<div className="flex min-w-0 items-center gap-4">
								<div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted font-semibold text-foreground">
									{getInitials(userEmail)}
								</div>
								<div className="min-w-0">
									<CardTitle className="truncate">{userEmail}</CardTitle>
									<CardDescription className="mt-1">
										{roleScopeLabels[role]} · {ROLE_LABELS[role]}
									</CardDescription>
								</div>
							</div>
							<UserCircle
								className="size-6 shrink-0 text-muted-foreground"
								aria-hidden="true"
							/>
						</CardHeader>
						<CardContent className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
							<div className="space-y-3 text-sm">
								<div>
									<p className="text-muted-foreground">Rol efectivo</p>
									<p className="mt-1 font-medium text-foreground">
										{ROLE_LABELS[role]}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Último acceso</p>
									<p className="mt-1 font-medium text-foreground">
										{formatDate(user?.last_sign_in_at)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Cuenta creada</p>
									<p className="mt-1 font-medium text-foreground">
										{formatDate(user?.created_at)}
									</p>
								</div>
							</div>
							<div className="space-y-2">
								<p className="text-sm leading-6 text-muted-foreground">
									{roleDescriptions[role]}
								</p>
								<PermissionPill
									label="Gestionar usuarios"
									enabled={canManageUsers}
								/>
								<PermissionPill
									label="Crear y editar red"
									enabled={canWriteNetwork}
								/>
								<PermissionPill
									label="Eliminar infraestructura"
									enabled={canDeleteNetwork}
								/>
							</div>
						</CardContent>
					</Card>

					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Settings className="size-4" aria-hidden="true" />
								Settings del sistema
							</CardTitle>
							<CardDescription>
								Estado rápido de configuración y accesos de administración.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<SettingStatus
								label="Supabase"
								enabled={supabaseReady}
								description="Auth, base de datos, RLS y service layer disponibles."
							/>
							<SettingStatus
								label="Mapbox"
								enabled={mapboxReady}
								description="Token de mapa configurado para la vista operativa."
							/>
							<div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
								<Button asChild variant="outline" className="justify-start">
									<Link href="/admin/users">
										<KeyRound className="size-4" aria-hidden="true" />
										Roles
									</Link>
								</Button>
								<Button asChild variant="outline" className="justify-start">
									<Link href="/admin/audit">
										<SlidersHorizontal className="size-4" aria-hidden="true" />
										Auditoría
									</Link>
								</Button>
								<Button asChild variant="outline" className="justify-start">
									<Link href="/admin/settings">
										<Settings className="size-4" aria-hidden="true" />
										Settings
									</Link>
								</Button>
							</div>
						</CardContent>
					</Card>
				</section>

				<section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<MetricCard
						title="Redes configuradas"
						value={formatNumber(networkRows.length)}
						description={`${formatNumber(elementRows.length)} elementos registrados`}
						icon={RadioTower}
						tone="border-[var(--gpon-olt)]/30 bg-[var(--gpon-olt)]/10 text-[var(--gpon-olt)]"
					/>
					<MetricCard
						title="Salud operacional"
						value={`${activePercent}%`}
						description={`${formatNumber(operationalElements)} elementos activos o planificados`}
						icon={CheckCircle2}
						tone="border-[var(--status-online)]/30 bg-[var(--status-online)]/10 text-[var(--status-online)]"
					/>
					<MetricCard
						title="Fibra trazada"
						value={formatKm(totalFiberMeters)}
						description={`${formatNumber(routeRows.length)} rutas de fibra`}
						icon={Cable}
						tone="border-[var(--gpon-splitter)]/30 bg-[var(--gpon-splitter)]/10 text-[var(--gpon-splitter)]"
					/>
					<MetricCard
						title="Riesgos abiertos"
						value={formatNumber(riskRoutePoints + damagedRoutes)}
						description={`${formatNumber(riskRoutePoints)} puntos críticos · ${formatNumber(damagedRoutes)} rutas dañadas`}
						icon={AlertTriangle}
						tone="border-[var(--severity-high)]/30 bg-[var(--severity-high)]/10 text-[var(--severity-high)]"
					/>
				</section>

				<section className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardTitle>Operación de infraestructura</CardTitle>
							<CardDescription>
								Inventario, estados y capacidad disponible para decisiones de
								administración.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-6 lg:grid-cols-2">
							<div className="space-y-4">
								<div className="flex items-center gap-2 text-sm font-medium">
									<Split className="size-4 text-[var(--gpon-splitter)]" />
									Distribución de elementos
								</div>
								<div className="space-y-3">
									{(["olt", "splitter", "nap"] as ElementType[]).map((type) => (
										<ProgressLine
											key={type}
											label={elementLabels[type]}
											value={elementCounts[type]}
											total={elementRows.length}
											tone={type === "nap" ? "good" : "neutral"}
										/>
									))}
								</div>
								<Separator />
								<div className="grid grid-cols-2 gap-3 text-sm">
									<div>
										<p className="text-muted-foreground">Puertos NAP</p>
										<p className="mt-1 font-mono text-lg text-foreground">
											{formatNumber(usedNapPorts)} /{" "}
											{formatNumber(totalNapPorts)}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground">Uso de capacidad</p>
										<p className="mt-1 font-mono text-lg text-foreground">
											{portUsePercent}%
										</p>
									</div>
								</div>
							</div>

							<div className="space-y-4">
								<div className="flex items-center gap-2 text-sm font-medium">
									<Activity className="size-4 text-[var(--status-online)]" />
									Estado de red
								</div>
								<div className="space-y-3">
									{(["active", "planned", "faulty", "inactive"] as const).map(
										(status) => (
											<ProgressLine
												key={status}
												label={statusLabels[status]}
												value={elementStatusCounts[status]}
												total={elementRows.length}
												tone={status === "faulty" ? "warn" : "neutral"}
											/>
										),
									)}
								</div>
								<Separator />
								<div className="grid grid-cols-2 gap-3 text-sm">
									<div>
										<p className="text-muted-foreground">Rutas activas</p>
										<p className="mt-1 font-mono text-lg text-foreground">
											{formatNumber(routeStatusCounts.active)}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground">Rutas dañadas</p>
										<p className="mt-1 font-mono text-lg text-foreground">
											{formatNumber(routeStatusCounts.damaged)}
										</p>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardTitle>Calidad de datos</CardTitle>
							<CardDescription>
								Confiabilidad geográfica y puntos que requieren revisión.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5">
							<div className="flex items-end justify-between gap-4">
								<div>
									<p className="text-sm text-muted-foreground">
										Ubicaciones verificadas
									</p>
									<p className="mt-1 font-mono text-3xl text-foreground">
										{verifiedPercent}%
									</p>
								</div>
								<Sparkles
									className="size-9 text-[var(--gpon-ont)]"
									aria-hidden="true"
								/>
							</div>
							<div className="space-y-3">
								{(
									[
										"verified",
										"gps_captured",
										"drawn",
										"approximate",
										"unknown",
									] as DataQuality[]
								).map((quality) => (
									<ProgressLine
										key={quality}
										label={qualityLabels[quality]}
										value={qualityCounts[quality]}
										total={elementRows.length}
										tone={quality === "verified" ? "good" : "neutral"}
									/>
								))}
							</div>
							<Separator />
							<div className="flex items-center justify-between gap-4 text-sm">
								<span className="text-muted-foreground">
									Puntos de ruta registrados
								</span>
								<span className="font-mono text-foreground">
									{formatNumber(routePointRows.length)}
								</span>
							</div>
						</CardContent>
					</Card>
				</section>

				<section className="grid gap-4 xl:grid-cols-[0.95fr_1.35fr]">
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardTitle>Acciones administrativas</CardTitle>
							<CardDescription>
								Accesos directos a las tareas más frecuentes.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							<Link
								href="/networks"
								className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm transition-colors hover:bg-muted/55"
							>
								<span className="flex items-center gap-2">
									<Network className="size-4 text-[var(--gpon-olt)]" />
									Crear o editar redes
								</span>
								<ArrowRight className="size-4 text-muted-foreground" />
							</Link>
							<Link
								href="/map"
								className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm transition-colors hover:bg-muted/55"
							>
								<span className="flex items-center gap-2">
									<Route className="size-4 text-[var(--gpon-splitter)]" />
									Revisar mapa operativo
								</span>
								<ArrowRight className="size-4 text-muted-foreground" />
							</Link>
							<Link
								href="/admin/users"
								className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm transition-colors hover:bg-muted/55"
							>
								<span className="flex items-center gap-2">
									<Users className="size-4 text-[var(--gpon-ont)]" />
									Administrar usuarios
								</span>
								<ArrowRight className="size-4 text-muted-foreground" />
							</Link>
							<Link
								href="/admin/audit"
								className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm transition-colors hover:bg-muted/55"
							>
								<span className="flex items-center gap-2">
									<FileClock className="size-4 text-[var(--severity-high)]" />
									Ver auditoría
								</span>
								<ArrowRight className="size-4 text-muted-foreground" />
							</Link>
							<div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
								<span className="flex items-center gap-2">
									<Wifi className="size-4 text-[var(--gpon-ont)]" />
									Monitoreo ONT
								</span>
								<Badge variant="outline">Próximo</Badge>
							</div>
						</CardContent>
					</Card>

					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardTitle>Redes recientes</CardTitle>
							<CardDescription>
								Últimas redes actualizadas y su tamaño operativo.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{recentNetworks.length > 0 ? (
								<div className="divide-y divide-border">
									{recentNetworks.map((network) => (
										<Link
											key={network.id}
											href={`/networks/${network.id}`}
											className="flex items-center justify-between gap-4 py-3 text-sm transition-colors hover:text-primary"
										>
											<div className="min-w-0">
												<p className="truncate font-medium text-foreground">
													{network.name}
												</p>
												<p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
													<Clock3 className="size-3" />
													{new Intl.DateTimeFormat("es-EC", {
														dateStyle: "medium",
													}).format(new Date(network.updated_at))}
												</p>
											</div>
											<div className="flex shrink-0 items-center gap-5 text-right">
												<div>
													<p className="font-mono text-foreground">
														{formatNumber(network.element_count)}
													</p>
													<p className="text-[11px] text-muted-foreground">
														elementos
													</p>
												</div>
												<div>
													<p className="font-mono text-foreground">
														{formatNumber(network.route_count)}
													</p>
													<p className="text-[11px] text-muted-foreground">
														rutas
													</p>
												</div>
												<ArrowRight className="size-4 text-muted-foreground" />
											</div>
										</Link>
									))}
								</div>
							) : (
								<div className="rounded-lg border border-dashed border-border py-10 text-center">
									<p className="text-sm text-muted-foreground">
										Todavía no hay redes configuradas.
									</p>
									<Button asChild className="mt-4">
										<Link href="/networks">Crear primera red</Link>
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
				</section>
			</div>
		</div>
	);
}
