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
	fiberLoss: number;
	splitterLoss: number;
	spliceLoss: number;
	connectorLoss: number;
	totalLoss: number;
	margin: number | null;
	status: OpticalStatus;
	cumulativeLengthMeters: number;
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
