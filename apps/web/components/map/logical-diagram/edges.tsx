"use client";

import { OPTICAL_STATUS_COLOR } from "@/lib/gpon/optical-budget";
import { CABLE_COLOR } from "@/lib/map/palette";
import { NODE_HEIGHT, NODE_WIDTH } from "./layout-engine";
import type { LayoutNode } from "./types";

interface EdgesProps {
	layoutNodes: LayoutNode[];
	visibleIds: Set<string>;
	highlightedRouteIds: Set<string> | null; // null = no highlighting active
}

export function Edges({
	layoutNodes,
	visibleIds,
	highlightedRouteIds,
}: EdgesProps) {
	return (
		<>
			{layoutNodes.map((node) => {
				if (!node.tree.routeFromParent) return null;
				if (!visibleIds.has(node.tree.element.id)) return null;

				const parentId = node.tree.routeFromParent.from_element_id;
				if (!parentId || !visibleIds.has(parentId)) return null;

				const parentNode = layoutNodes.find(
					(ln) => ln.tree.element.id === parentId,
				);
				if (!parentNode) return null;

				const routeType = node.tree.routeFromParent.type ?? "distribution";
				const isFeeder = routeType === "feeder";
				const color = isFeeder ? CABLE_COLOR.feeder : CABLE_COLOR.distribution;
				const strokeWidth = isFeeder ? 2.5 : 1.8;

				const isOnPath =
					!highlightedRouteIds ||
					highlightedRouteIds.has(node.tree.routeFromParent.id);
				const opacity = isOnPath ? 1 : 0.1;

				// Parent right-center → child left-center
				const x1 = parentNode.x + NODE_WIDTH;
				const y1 = parentNode.y + NODE_HEIGHT / 2;
				const x2 = node.x;
				const y2 = node.y + NODE_HEIGHT / 2;
				const dx = (x2 - x1) * 0.45;
				const d = `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;

				const midX = (x1 + x2) / 2;
				const midY = (y1 + y2) / 2;

				const km = node.tree.routeFromParent.length_meters
					? `${(node.tree.routeFromParent.length_meters / 1000).toFixed(2)} km`
					: null;

				const statusColor = OPTICAL_STATUS_COLOR[node.budget.status];

				return (
					<g
						key={`edge-${node.tree.element.id}`}
						style={{ opacity, transition: "opacity 0.15s ease" }}
					>
						{/* Edge curve */}
						<path
							d={d}
							stroke={color}
							strokeWidth={strokeWidth}
							fill="none"
							strokeOpacity={isOnPath ? 0.75 : 1}
						/>

						{/* Status dot at midpoint */}
						{isOnPath && node.budget.margin !== null && (
							<circle cx={midX} cy={midY} r={3.5} fill={statusColor} />
						)}

						{/* Distance label (only when on highlighted path) */}
						{isOnPath && km && (
							<g>
								<rect
									x={midX - 22}
									y={midY - 14}
									width={44}
									height={11}
									rx={3}
									fill="#111213"
									fillOpacity={0.88}
								/>
								<text
									x={midX}
									y={midY - 5.5}
									textAnchor="middle"
									fontSize={7.5}
									fill="#6b7280"
								>
									{km}
								</text>
							</g>
						)}
					</g>
				);
			})}
		</>
	);
}
