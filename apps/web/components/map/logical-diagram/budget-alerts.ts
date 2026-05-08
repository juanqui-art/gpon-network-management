import type { OpticalStatus } from "@/lib/gpon/optical-budget";
import { EQUIPMENT_TYPE_LABEL } from "@/lib/gpon/symbology";
import type { LayoutNode } from "./types";

export type OpticalBudgetAlertLevel = "deficient" | "tight";

export interface OpticalBudgetAlert {
	id: string;
	code: string;
	type: string;
	level: OpticalBudgetAlertLevel;
	margin: number | null;
	status: OpticalStatus;
	reason: string;
}

export const ALERT_LEVEL_STYLES: Record<
	OpticalBudgetAlertLevel,
	{ label: string; color: string; bg: string; border: string }
> = {
	deficient: {
		label: "Deficiente",
		color: "#fb4d6d",
		bg: "rgba(251,77,109,0.1)",
		border: "rgba(251,77,109,0.28)",
	},
	tight: {
		label: "Ajustado",
		color: "#f59e0b",
		bg: "rgba(245,158,11,0.1)",
		border: "rgba(245,158,11,0.28)",
	},
};

export function buildOpticalBudgetAlerts(
	layoutNodes: LayoutNode[],
): OpticalBudgetAlert[] {
	return layoutNodes
		.flatMap((node) => {
			const budget = node.budget;
			if (budget.margin === null) return [];
			if (budget.status !== "red" && budget.status !== "yellow") return [];

			const level: OpticalBudgetAlertLevel =
				budget.status === "red" ? "deficient" : "tight";
			const el = node.tree.element;
			return [
				{
					id: el.id,
					code: el.code ?? el.name ?? "Sin código",
					type: EQUIPMENT_TYPE_LABEL[el.type] ?? el.type,
					level,
					margin: budget.margin,
					status: budget.status,
					reason:
						level === "deficient"
							? "pérdida acumulada fuera del margen de diseño"
							: "margen bajo para degradación, empalmes o reparaciones",
				},
			];
		})
		.sort((a, b) => {
			if (a.level !== b.level) return a.level === "deficient" ? -1 : 1;
			return (
				(a.margin ?? Number.POSITIVE_INFINITY) -
				(b.margin ?? Number.POSITIVE_INFINITY)
			);
		});
}
