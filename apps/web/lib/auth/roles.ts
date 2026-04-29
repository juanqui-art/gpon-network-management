import type { UserRole } from "@/lib/types/gpon";

export const ROLE_LABELS: Record<UserRole, string> = {
	admin: "Administrador",
	network_engineer: "Ingeniería de red",
	outside_plant: "Planta externa",
	installer: "Instalación",
	support: "Soporte",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
	admin: "Control total del sistema, usuarios, red y eliminación.",
	network_engineer: "Diseño, edición y validación técnica de infraestructura.",
	outside_plant: "Revisión de campo, calidad geográfica y observaciones.",
	installer: "Trabajo de instalación y actualización operativa asignada.",
	support: "Lectura operativa y seguimiento de incidencias.",
};

export const USER_ROLES: UserRole[] = [
	"admin",
	"network_engineer",
	"outside_plant",
	"installer",
	"support",
];

export function getUserRoleFromMetadata(
	appMetadata: Record<string, unknown> | null | undefined,
	userMetadata?: Record<string, unknown> | null,
): UserRole {
	const role = appMetadata?.role ?? userMetadata?.role;
	return USER_ROLES.includes(role as UserRole) ? (role as UserRole) : "support";
}
