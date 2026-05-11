"use client";

import {
	CheckCircle2,
	Clock3,
	KeyRound,
	MailPlus,
	MoreHorizontal,
	Send,
	ShieldCheck,
	UserCog,
	UserRoundX,
} from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import {
	inviteUser,
	resendInvitation,
	sendPasswordReset,
	setUserSuspended,
	type UserActionState,
	updateUserRole,
} from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, USER_ROLES } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/types/gpon";

export interface AdminUserView {
	id: string;
	email: string;
	role: UserRole;
	createdAt: string;
	lastSignInAt: string | null;
	emailConfirmedAt: string | null;
	bannedUntil: string | null;
	isCurrentUser: boolean;
}

const initialState: UserActionState = {
	status: "idle",
	message: null,
};

function formatDate(value: string | null): string {
	if (!value) return "Sin registro";
	return new Intl.DateTimeFormat("es-EC", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function isSuspended(user: AdminUserView): boolean {
	if (!user.bannedUntil) return false;
	return new Date(user.bannedUntil).getTime() > Date.now();
}

function feedbackToneClass(status: UserActionState["status"]): string {
	if (status === "success") {
		return "text-[var(--status-online)]";
	}
	if (status === "error") {
		return "text-[#ffb3c1]";
	}
	return "text-muted-foreground";
}

function UserRow({ user }: { user: AdminUserView }) {
	const [roleState, roleAction, rolePending] = useActionState(
		updateUserRole,
		initialState,
	);
	const [suspendState, suspendAction, suspendPending] = useActionState(
		setUserSuspended,
		initialState,
	);
	const [resendState, resendAction, resendPending] = useActionState(
		resendInvitation,
		initialState,
	);
	const [resetState, resetAction, resetPending] = useActionState(
		sendPasswordReset,
		initialState,
	);

	const [roleValue, setRoleValue] = useState<UserRole>(user.role);

	useEffect(() => {
		setRoleValue(user.role);
	}, [user.role]);

	useEffect(() => {
		if (roleState.status === "error") {
			setRoleValue(user.role);
		}
	}, [roleState, user.role]);

	const suspended = isSuspended(user);
	const confirmed = Boolean(user.emailConfirmedAt);
	const canResend = !user.isCurrentUser && !confirmed;
	const canReset = !user.isCurrentUser && confirmed;

	return (
		<tr>
			<td className="py-3 pr-4">
				<div>
					<p className="font-medium text-foreground">{user.email}</p>
					<p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
						{user.id.slice(0, 8)}
					</p>
					{!confirmed && (
						<Badge
							variant="outline"
							className="mt-1 border-amber-500/35 bg-amber-500/10 text-[11px] text-amber-200"
						>
							Pendiente confirmación
						</Badge>
					)}
				</div>
			</td>
			<td className="py-3 pr-4">
				<form action={roleAction}>
					<input type="hidden" name="userId" value={user.id} />
					<select
						name="role"
						value={roleValue}
						disabled={user.isCurrentUser || rolePending}
						onChange={(event) => {
							setRoleValue(event.currentTarget.value as UserRole);
							event.currentTarget.form?.requestSubmit();
						}}
						className="h-9 min-w-40 rounded-lg border border-input bg-muted/40 px-2 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{USER_ROLES.map((role) => (
							<option key={role} value={role}>
								{ROLE_LABELS[role]}
							</option>
						))}
					</select>
				</form>
				{roleState.message && (
					<p
						className={`mt-1 text-xs ${feedbackToneClass(roleState.status)}`}
						role="status"
					>
						{roleState.message}
					</p>
				)}
			</td>
			<td className="py-3 pr-4">
				<Badge
					variant="outline"
					className={
						suspended
							? "border-[var(--status-alarm)]/35 bg-[var(--status-alarm)]/10 text-[#ffb3c1]"
							: "border-[var(--status-online)]/35 bg-[var(--status-online)]/10 text-[var(--status-online)]"
					}
				>
					{suspended ? "Suspendido" : "Activo"}
				</Badge>
			</td>
			<td className="py-3 pr-4 text-muted-foreground">
				<span className="inline-flex items-center gap-1.5">
					<Clock3 className="size-3.5" />
					{formatDate(user.lastSignInAt)}
				</span>
			</td>
			<td className="py-3 pr-4 text-muted-foreground">
				{formatDate(user.createdAt)}
			</td>
			<td className="py-3 text-right">
				<div className="flex flex-col items-end gap-1.5">
					{canResend && (
						<form action={resendAction} className="flex flex-col items-end">
							<input type="hidden" name="userId" value={user.id} />
							<Button
								type="submit"
								variant="outline"
								size="sm"
								disabled={resendPending}
								title="Reenviar invitación por email"
							>
								<Send className="size-4" />
								{resendPending ? "Enviando..." : "Reenviar"}
							</Button>
							{resendState.message && (
								<p
									className={`mt-1 text-xs ${feedbackToneClass(resendState.status)}`}
									role="status"
								>
									{resendState.message}
								</p>
							)}
						</form>
					)}
					{canReset && (
						<form action={resetAction} className="flex flex-col items-end">
							<input type="hidden" name="userId" value={user.id} />
							<Button
								type="submit"
								variant="outline"
								size="sm"
								disabled={resetPending}
								title="Enviar enlace de reset de contraseña"
							>
								<KeyRound className="size-4" />
								{resetPending ? "Enviando..." : "Reset contraseña"}
							</Button>
							{resetState.message && (
								<p
									className={`mt-1 text-xs ${feedbackToneClass(resetState.status)}`}
									role="status"
								>
									{resetState.message}
								</p>
							)}
						</form>
					)}
					<form action={suspendAction} className="flex flex-col items-end">
						<input type="hidden" name="userId" value={user.id} />
						<input
							type="hidden"
							name="action"
							value={suspended ? "activate" : "suspend"}
						/>
						<Button
							type="submit"
							variant="outline"
							size="sm"
							disabled={user.isCurrentUser || suspendPending}
						>
							<MoreHorizontal className="size-4" />
							{suspendPending
								? "Procesando..."
								: suspended
									? "Reactivar"
									: "Suspender"}
						</Button>
						{suspendState.message && (
							<p
								className={`mt-1 text-xs ${feedbackToneClass(suspendState.status)}`}
								role="status"
							>
								{suspendState.message}
							</p>
						)}
					</form>
				</div>
			</td>
		</tr>
	);
}

export function UsersClient({ users }: { users: AdminUserView[] }) {
	const [inviteState, inviteAction, invitePending] = useActionState(
		inviteUser,
		initialState,
	);

	const activeUsers = users.filter((user) => !isSuspended(user)).length;
	const suspendedUsers = users.length - activeUsers;
	const adminUsers = users.filter((user) => user.role === "admin").length;

	return (
		<div className="min-h-full bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<Badge variant="outline" className="mb-3 border-border bg-muted/60">
							<ShieldCheck className="mr-1 size-3" aria-hidden="true" />
							Solo administradores
						</Badge>
						<h1 className="text-2xl font-semibold text-foreground">
							Usuarios y roles
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
							Administra accesos, roles operativos y suspensión de cuentas para
							proteger la consola GPON.
						</p>
					</div>
				</section>

				<section className="grid gap-3 md:grid-cols-3">
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardDescription>Usuarios activos</CardDescription>
							<CardTitle className="flex items-center gap-2 text-2xl">
								<CheckCircle2 className="size-5 text-[var(--status-online)]" />
								{activeUsers}
							</CardTitle>
						</CardHeader>
					</Card>
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardDescription>Administradores</CardDescription>
							<CardTitle className="flex items-center gap-2 text-2xl">
								<UserCog className="size-5 text-[var(--gpon-olt)]" />
								{adminUsers}
							</CardTitle>
						</CardHeader>
					</Card>
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardDescription>Cuentas suspendidas</CardDescription>
							<CardTitle className="flex items-center gap-2 text-2xl">
								<UserRoundX className="size-5 text-[var(--status-alarm)]" />
								{suspendedUsers}
							</CardTitle>
						</CardHeader>
					</Card>
				</section>

				<section className="grid gap-4 xl:grid-cols-[0.8fr_1.4fr]">
					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardTitle>Invitar usuario</CardTitle>
							<CardDescription>
								Envía una invitación y asigna el rol inicial desde el servidor.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form action={inviteAction} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										name="email"
										type="email"
										required
										placeholder="usuario@empresa.ec"
										className="h-10 bg-muted/40"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="role">Rol</Label>
									<select
										id="role"
										name="role"
										defaultValue="support"
										className="h-10 w-full rounded-lg border border-input bg-muted/40 px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
									>
										{USER_ROLES.map((role) => (
											<option key={role} value={role}>
												{ROLE_LABELS[role]}
											</option>
										))}
									</select>
								</div>
								{inviteState.message && (
									<div
										className={`rounded-lg border px-3 py-2 text-sm ${
											inviteState.status === "success"
												? "border-[var(--status-online)]/35 bg-[var(--status-online)]/10 text-[var(--status-online)]"
												: "border-[var(--status-alarm)]/35 bg-[var(--status-alarm)]/10 text-[#ffb3c1]"
										}`}
										role="status"
									>
										{inviteState.message}
									</div>
								)}
								<Button
									type="submit"
									disabled={invitePending}
									className="w-full"
								>
									<MailPlus className="size-4" aria-hidden="true" />
									{invitePending ? "Enviando..." : "Enviar invitación"}
								</Button>
							</form>
						</CardContent>
					</Card>

					<Card className="rounded-lg border-border/80 bg-card/80">
						<CardHeader>
							<CardTitle>Matriz de roles</CardTitle>
							<CardDescription>
								Base de permisos actual para módulos administrativos y
								operación.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-2 md:grid-cols-2">
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
				</section>

				<Card className="rounded-lg border-border/80 bg-card/80">
					<CardHeader>
						<CardTitle>Directorio de usuarios</CardTitle>
						<CardDescription>
							Cambia roles o suspende accesos sin exponer la service role al
							cliente.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<table className="w-full min-w-[860px] text-sm">
								<thead>
									<tr className="border-b border-border text-left text-xs text-muted-foreground">
										<th className="py-3 pr-4 font-medium">Usuario</th>
										<th className="py-3 pr-4 font-medium">Rol</th>
										<th className="py-3 pr-4 font-medium">Estado</th>
										<th className="py-3 pr-4 font-medium">Último acceso</th>
										<th className="py-3 pr-4 font-medium">Creado</th>
										<th className="py-3 text-right font-medium">Acciones</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{users.map((user) => (
										<UserRow key={user.id} user={user} />
									))}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
