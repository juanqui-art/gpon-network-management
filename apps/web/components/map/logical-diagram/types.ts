import type {
	FiberRoute,
	InfrastructureElement,
	RoutePoint,
} from "@/components/map/types";
import type { OpticalStatus } from "@/lib/gpon/optical-budget";

export interface TreeNode {
	element: InfrastructureElement;
	routeFromParent: FiberRoute | null;
	splicesOnRoute: RoutePoint[];
	children: TreeNode[];
	depth: number;
}

export interface PathBudget {
	headendLoss: number;
	fiberLoss: number;
	splitterLoss: number;
	spliceLoss: number;
	connectorLoss: number;
	additionalLoss: number;
	physicalLoss: number;
	safetyMargin: number;
	totalLoss: number;
	margin: number | null;
	txPowerDbm: number | null;
	rxPowerDbm: number | null;
	rxSensitivityDbm: number | null;
	powerMarginDb: number | null;
	designPowerMarginDb: number | null;
	status: OpticalStatus;
	cumulativeLengthMeters: number;
	lossEvents: BudgetLossEvent[];
	warnings: string[];
}

export interface BudgetLossEvent {
	kind:
		| "headend"
		| "fiber"
		| "fusion"
		| "splitter"
		| "connector"
		| "adjustment";
	label: string;
	loss: number;
	section: string;
	shortLabel: string;
}

export interface LayoutNode {
	tree: TreeNode;
	budget: PathBudget;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface NetworkStats {
	oltCount: number;
	splitterCount: number;
	napCount: number;
	totalLengthMeters: number;
	worstStatus: OpticalStatus;
	worstMargin: number | null;
	totalPorts: number;
	usedPorts: number;
	reservedPorts: number;
}
