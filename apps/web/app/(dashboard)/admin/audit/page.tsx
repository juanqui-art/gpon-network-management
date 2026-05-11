import {
	Activity,
	BadgeCheck,
	FileClock,
	Filter,
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
	"user.role_updated": "Rol actualizado",
	"user.suspended": "Usuario suspendido",
	"user.reactivated": "Usuario reactivado",
};

const actionTones: Record<string, string> = {
	"user.invited":
		"border-[var(--gpon-olt)]/35 bg-[var(--gpon-olt)]/10 text-[var(--gpon-olt)]",
	"user.role_updated":
		"border-[var(--gpon-splitter)]/35 bg-[var(--gpon-splitter)]/10 text-[var(--gpon-splitter)]",
	"user.suspended":
		"border-[var(--status-alarm)]/35 bg-[var(--status-alarm)]/10 text-[#ffb3c1]",
	"user.reactivated":
		"border-[var(--status-online)]/35 bg-[var(--status-online)]/10 text-[var(--status-online)]",
};

function formatDate(value: string): string {
	return new Intl.DateTimeFormat("es-EC", {
		dateStyle: "medium",
		timeStyle: "medium",
	}).format(new Date(value));
}

function formatMetadata(metadata: Record<string, unknown>): string {
	const entries = Object.entries(metadata).filter(
		([, value]) => value !== null,
	);
	if (entries.length === 0) return "Sin metadatos";
	return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
}

export default async function AuditPage({
	searchParams,
}: {
	searchParams: Promise<{ action?: string; q?: string }>;
}) {
	await requireAdmin();
	const { action, q } = await searchParams;
	const admin = createAdminClient();

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

	return (
		<div className="min-h-full bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<Badge variant="outline" className="mb-3 border-border bg-muted/60">
							<ShieldCheck className="mr-1 size-3" aria-hidden="true" />
							Trazabilidad administrativa
						</Badge>
						<h1 className="text-2xl font-semibold text-foreground">
							Auditoría
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
							Registro de acciones sensibles realizadas por administradores.
							Empieza con usuarios y roles, y queda listo para extenderse a red,
							incidentes y configuración.
						</p>
					</div>
				</section>

				<section className="grid gap-3 md:grid-cols-3">
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
				</section>

				<Card className="rounded-lg border-border/80 bg-card/80">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Filter className="size-4" />
							Filtros
						</CardTitle>
						<CardDescription>
							Filtra por tipo de acción o busca por actor, target o
							identificador.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="grid gap-3 md:grid-cols-[240px_1fr_auto]">
							<select
								name="action"
								defaultValue={action ?? ""}
								className="h-10 rounded-lg border border-input bg-muted/40 px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
							>
								<option value="">Todas las acciones</option>
								{actions.map((item) => (
									<option key={item} value={item}>
										{actionLabels[item]}
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
						</form>
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
													className={actionTones[row.action] ?? "border-border"}
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
													{formatMetadata(row.metadata)}
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
															className={
																actionTones[row.action] ?? "border-border"
															}
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
														{formatMetadata(row.metadata)}
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
