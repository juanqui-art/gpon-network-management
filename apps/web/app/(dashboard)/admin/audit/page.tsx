import {
	Activity,
	BadgeCheck,
	FileClock,
	Filter,
	Network,
	ShieldCheck,
	UserRoundCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Auditoría" };

interface AuditLogRow {
	id: string;
	actor_user_id: string | null;
	actor_email: string | null;
	action: string;
	target_type: string;
	target_id: string | null;
	target_label: string | null;
	metadata: Record<string, unknown>;
	created_at: string;
}

const actionLabels: Record<string, string> = {
	"user.invited": "Invitación enviada",
	"user.invitation_resent": "Invitación reenviada",
	"user.role_updated": "Rol actualizado",
	"user.suspended": "Usuario suspendido",
	"user.reactivated": "Usuario reactivado",
	"user.password_reset_sent": "Reset de contraseña enviado",
	"user.deleted": "Usuario eliminado",
	"network.created": "Red creada",
	"network.updated": "Red modificada",
	"network.archived": "Red archivada",
	"network.deleted": "Red eliminada",
	"network_zone.created": "Zona creada",
	"network_zone.updated": "Zona modificada",
	"network_zone.deleted": "Zona eliminada",
	"infrastructure_element.created": "Elemento creado",
	"infrastructure_element.updated": "Elemento modificado",
	"infrastructure_element.deleted": "Elemento eliminado",
	"fiber_route.created": "Ruta creada",
	"fiber_route.updated": "Ruta modificada",
	"fiber_route.deleted": "Ruta eliminada",
	"route_point.created": "Punto creado",
	"route_point.updated": "Punto modificado",
	"route_point.deleted": "Punto eliminado",
};

const TONE_CREATE =
	"border-[var(--status-online)]/35 bg-[var(--status-online)]/10 text-[var(--status-online)]";
const TONE_UPDATE =
	"border-[var(--gpon-splitter)]/35 bg-[var(--gpon-splitter)]/10 text-[var(--gpon-splitter)]";
const TONE_DESTRUCTIVE =
	"border-[var(--status-alarm)]/35 bg-[var(--status-alarm)]/10 text-[#ffb3c1]";
const TONE_INFO =
	"border-[var(--gpon-olt)]/35 bg-[var(--gpon-olt)]/10 text-[var(--gpon-olt)]";

function actionTone(action: string): string {
	if (action === "user.reactivated") return TONE_CREATE;
	if (action.startsWith("user.invit") || action.endsWith("_sent"))
		return TONE_INFO;
	if (action.endsWith(".created")) return TONE_CREATE;
	if (
		action.endsWith(".deleted") ||
		action.endsWith(".archived") ||
		action.endsWith(".suspended")
	)
		return TONE_DESTRUCTIVE;
	if (action.endsWith(".updated")) return TONE_UPDATE;
	return "border-border";
}

const targetTypeLabels: Record<string, string> = {
	"auth.user": "Usuarios",
	network: "Redes",
	network_zone: "Zonas",
	infrastructure_element: "Elementos",
	fiber_route: "Rutas",
	route_point: "Puntos de ruta",
};

const NETWORK_TARGET_TYPES = new Set([
	"network",
	"network_zone",
	"infrastructure_element",
	"fiber_route",
	"route_point",
]);

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface NetworkOption {
	id: string;
	name: string;
	archived_at: string | null;
}

const selectClassName =
	"h-10 rounded-lg border border-input bg-muted/40 px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50";

function formatDate(value: string): string {
	return new Intl.DateTimeFormat("es-EC", {
		dateStyle: "medium",
		timeStyle: "medium",
	}).format(new Date(value));
}

function formatScalar(value: unknown): string {
	if (value === null || value === undefined) return "∅";
	if (typeof value === "object") return "{…}";
	const text = String(value);
	return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

function formatChanges(changes: Record<string, unknown>): string {
	return Object.entries(changes)
		.map(([field, change]) => {
			if (change && typeof change === "object" && "changed" in change) {
				return `${field}: geometría modificada`;
			}
			if (change && typeof change === "object" && "old" in change) {
				const { old, new: next } = change as { old: unknown; new: unknown };
				return `${field}: ${formatScalar(old)} → ${formatScalar(next)}`;
			}
			return `${field}: ${formatScalar(change)}`;
		})
		.join(" · ");
}

function formatMetadata(
	metadata: Record<string, unknown>,
	networkNames: Map<string, string>,
): string {
	const entries = Object.entries(metadata).filter(
		([, value]) => value !== null && value !== undefined,
	);
	if (entries.length === 0) return "Sin metadatos";
	return entries
		.map(([key, value]) => {
			if (key === "changes" && value && typeof value === "object") {
				return formatChanges(value as Record<string, unknown>);
			}
			if (key === "snapshot") return "snapshot guardado";
			if (key === "network_id") {
				const id = String(value);
				return `red: ${networkNames.get(id) ?? id.slice(0, 8)}`;
			}
			if (key === "source") return `origen: ${String(value)}`;
			return `${key}: ${formatScalar(value)}`;
		})
		.join(" · ");
}

export default async function AuditPage({
	searchParams,
}: {
	searchParams: Promise<{
		action?: string;
		type?: string;
		network?: string;
		q?: string;
	}>;
}) {
	await requireAdmin();
	const params = await searchParams;
	const q = params.q;
	// Solo valores conocidos llegan al query; el resto se ignora.
	const action =
		params.action && Object.hasOwn(actionLabels, params.action)
			? params.action
			: undefined;
	const type =
		params.type && Object.hasOwn(targetTypeLabels, params.type)
			? params.type
			: undefined;
	const network =
		params.network && UUID_PATTERN.test(params.network)
			? params.network
			: undefined;
	const hasFilters = Boolean(action || type || network || q);
	const admin = createAdminClient();

	const { data: networkData, error: networkError } = await admin
		.from("networks")
		.select("id, name, archived_at")
		.order("name");
	if (networkError) throw new Error(networkError.message);
	const networks = (networkData ?? []) as NetworkOption[];
	const networkNames = new Map(networks.map((item) => [item.id, item.name]));

	let query = admin
		.from("audit_logs")
		.select(
			"id, actor_user_id, actor_email, action, target_type, target_id, target_label, metadata, created_at",
		)
		.order("created_at", { ascending: false })
		.limit(100);

	if (action) {
		query = query.eq("action", action);
	}
	if (type) {
		query = query.eq("target_type", type);
	}
	if (network) {
		// Usa el índice audit_logs_network_idx (migración 028).
		query = query.eq("metadata->>network_id", network);
	}

	const { data, error } = await query;
	if (error) throw new Error(error.message);

	const rows = ((data ?? []) as AuditLogRow[]).filter((row) => {
		if (!q) return true;
		const needle = q.toLowerCase();
		return [
			row.actor_email,
			row.target_label,
			row.action,
			row.target_type,
			row.target_id,
		]
			.filter(Boolean)
			.some((value) => String(value).toLowerCase().includes(needle));
	});

	const actions = Object.keys(actionLabels);
	const actorCount = new Set(
		rows.map((row) => row.actor_user_id).filter(Boolean),
	).size;
	const userEvents = rows.filter(
		(row) => row.target_type === "auth.user",
	).length;
	const networkEvents = rows.filter((row) =>
		NETWORK_TARGET_TYPES.has(row.target_type),
	).length;

	return (
		<div className="h-full overflow-y-auto bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<Badge variant="outline" className="mb-3 border-border bg-muted/60">
							<ShieldCheck className="mr-1 size-3" aria-hidden="true" />
							Trazabilidad administrativa
						</Badge>
						<h1 className="text-balance text-2xl font-semibold text-foreground">
							Auditoría
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
							Registro de acciones sensibles: gestión de usuarios y todo cambio
							sobre redes, zonas, elementos, rutas y puntos (registrado por
							triggers en la base de datos, incluso fuera de la app).
						</p>
					</div>
				</section>

				<section className="grid gap-3 md:grid-cols-4">
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardDescription>Eventos visibles</CardDescription>
							<CardTitle className="flex items-center gap-2 text-2xl">
								<Activity className="size-5 text-[var(--gpon-olt)]" />
								{rows.length}
							</CardTitle>
						</CardHeader>
					</Card>
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardDescription>Actores únicos</CardDescription>
							<CardTitle className="flex items-center gap-2 text-2xl">
								<UserRoundCog className="size-5 text-[var(--gpon-splitter)]" />
								{actorCount}
							</CardTitle>
						</CardHeader>
					</Card>
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardDescription>Eventos de usuarios</CardDescription>
							<CardTitle className="flex items-center gap-2 text-2xl">
								<BadgeCheck className="size-5 text-[var(--status-online)]" />
								{userEvents}
							</CardTitle>
						</CardHeader>
					</Card>
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardDescription>Eventos de red</CardDescription>
							<CardTitle className="flex items-center gap-2 text-2xl">
								<Network className="size-5 text-[var(--gpon-nap)]" />
								{networkEvents}
							</CardTitle>
						</CardHeader>
					</Card>
				</section>

				<Card className="rounded-lg border-border/80 bg-card/80">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Filter className="size-4" />
							Filtros
						</CardTitle>
						<CardDescription>
							Filtra por acción, tipo de objeto o red, o busca por actor, target
							o identificador. Los filtros se aplican en la base de datos; la
							búsqueda de texto, sobre los 100 eventos resultantes.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[200px_180px_220px_1fr_auto_auto]">
							<select
								name="action"
								aria-label="Acción"
								defaultValue={action ?? ""}
								className={selectClassName}
							>
								<option value="">Todas las acciones</option>
								{actions.map((item) => (
									<option key={item} value={item}>
										{actionLabels[item]}
									</option>
								))}
							</select>
							<select
								name="type"
								aria-label="Tipo de objeto"
								defaultValue={type ?? ""}
								className={selectClassName}
							>
								<option value="">Todos los tipos</option>
								{Object.entries(targetTypeLabels).map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</select>
							<select
								name="network"
								aria-label="Red"
								defaultValue={network ?? ""}
								className={selectClassName}
							>
								<option value="">Todas las redes</option>
								{networks.map((item) => (
									<option key={item.id} value={item.id}>
										{item.archived_at ? `${item.name} (archivada)` : item.name}
									</option>
								))}
							</select>
							<input
								name="q"
								defaultValue={q ?? ""}
								placeholder="Buscar actor, usuario o acción"
								className="h-10 rounded-lg border border-input bg-muted/40 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50"
							/>
							<button
								type="submit"
								className="h-10 rounded-lg border border-border bg-muted px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
							>
								Aplicar
							</button>
							{hasFilters && (
								<a
									href="/admin/audit"
									className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
								>
									Limpiar
								</a>
							)}
						</form>
						{network && (
							<p className="mt-3 text-xs text-muted-foreground">
								Los puntos de ruta borrados junto con su ruta no quedan
								asociados a la red; aparecen en el evento de borrado de la ruta.
							</p>
						)}
					</CardContent>
				</Card>

				<Card className="rounded-lg border-border/80 bg-card/80">
					<CardHeader>
						<CardTitle>Eventos recientes</CardTitle>
						<CardDescription>
							Últimos 100 eventos registrados por el sistema.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{rows.length > 0 ? (
							<>
								{/* Mobile: stacked cards */}
								<div className="flex flex-col gap-3 md:hidden">
									{rows.map((row) => (
										<div
											key={row.id}
											className="space-y-2 rounded-lg border border-border bg-card/80 p-4"
										>
											<div className="flex items-start justify-between gap-3">
												<Badge
													variant="outline"
													className={actionTone(row.action)}
												>
													{actionLabels[row.action] ?? row.action}
												</Badge>
												<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
													<FileClock className="size-3.5" />
													{formatDate(row.created_at)}
												</span>
											</div>
											<div className="grid grid-cols-2 gap-3 border-t border-border pt-2">
												<div className="min-w-0">
													<p className="text-[11px] uppercase text-muted-foreground">
														Actor
													</p>
													<p className="mt-1 truncate font-medium text-foreground">
														{row.actor_email ?? "Sistema"}
													</p>
													{row.actor_user_id && (
														<p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
															{row.actor_user_id.slice(0, 8)}
														</p>
													)}
												</div>
												<div className="min-w-0">
													<p className="text-[11px] uppercase text-muted-foreground">
														Target
													</p>
													<p className="mt-1 truncate font-medium text-foreground">
														{row.target_label ?? row.target_type}
													</p>
													<p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
														{row.target_id ?? row.target_type}
													</p>
												</div>
											</div>
											<div className="border-t border-border pt-2">
												<p className="text-[11px] uppercase text-muted-foreground">
													Detalle
												</p>
												<p className="mt-1 break-words text-xs text-muted-foreground">
													{formatMetadata(row.metadata, networkNames)}
												</p>
											</div>
										</div>
									))}
								</div>

								{/* Desktop: scrollable table */}
								<div className="hidden overflow-x-auto md:block">
									<table className="w-full min-w-[920px] text-sm">
										<thead>
											<tr className="border-b border-border text-left text-xs text-muted-foreground">
												<th className="py-3 pr-4 font-medium">Fecha</th>
												<th className="py-3 pr-4 font-medium">Acción</th>
												<th className="py-3 pr-4 font-medium">Actor</th>
												<th className="py-3 pr-4 font-medium">Target</th>
												<th className="py-3 font-medium">Detalle</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-border">
											{rows.map((row) => (
												<tr key={row.id}>
													<td className="py-3 pr-4 text-muted-foreground">
														<span className="inline-flex items-center gap-1.5">
															<FileClock className="size-3.5" />
															{formatDate(row.created_at)}
														</span>
													</td>
													<td className="py-3 pr-4">
														<Badge
															variant="outline"
															className={actionTone(row.action)}
														>
															{actionLabels[row.action] ?? row.action}
														</Badge>
													</td>
													<td className="py-3 pr-4">
														<p className="font-medium text-foreground">
															{row.actor_email ?? "Sistema"}
														</p>
														{row.actor_user_id && (
															<p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
																{row.actor_user_id.slice(0, 8)}
															</p>
														)}
													</td>
													<td className="py-3 pr-4">
														<p className="font-medium text-foreground">
															{row.target_label ?? row.target_type}
														</p>
														<p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
															{row.target_id ?? row.target_type}
														</p>
													</td>
													<td className="py-3 text-xs text-muted-foreground">
														{formatMetadata(row.metadata, networkNames)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</>
						) : (
							<div className="rounded-lg border border-dashed border-border py-12 text-center">
								<p className="text-sm text-muted-foreground">
									No hay eventos de auditoría para los filtros actuales.
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
