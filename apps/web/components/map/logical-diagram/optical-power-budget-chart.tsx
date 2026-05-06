"use client";

import {
	ColorType,
	CrosshairMode,
	createChart,
	createSeriesMarkers,
	type LineData,
	LineSeries,
	LineStyle,
	LineType,
	type SeriesMarker,
	type Time,
	type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";
import type { BudgetLossEvent, PathBudget } from "./types";

const BASE_TIME = 1_704_067_200 as UTCTimestamp;
const DAY = 86_400;

function formatDbm(value: number | null): string {
	return value === null ? "N/D" : `${value.toFixed(1)} dBm`;
}

function formatDb(value: number | null): string {
	return value === null ? "N/D" : `${value.toFixed(1)} dB`;
}

function stageTime(index: number): UTCTimestamp {
	return (BASE_TIME + index * DAY) as UTCTimestamp;
}

function eventColor(kind: BudgetLossEvent["kind"]): string {
	if (kind === "headend") return "#38d8ff";
	if (kind === "fiber") return "#8bdff4";
	if (kind === "fusion") return "#fb7185";
	if (kind === "splitter") return "#a78bfa";
	if (kind === "connector") return "#f6c768";
	return "#858585";
}

function eventShape(kind: BudgetLossEvent["kind"]) {
	if (kind === "splitter") return "square";
	if (kind === "connector") return "arrowDown";
	return "circle";
}

function sectionTitle(section: string): string {
	if (section === "Cabecera") return "OLT / cabecera";
	if (section === "Mufa / splitter primario") return "Splitter primario";
	if (section === "Distribucion hacia NAP") return "Distribucion";
	if (section === "Empalme puntual") return "Empalme";
	if (section === "NAP interna") return "NAP interna";
	if (section === "Puerto NAP") return "Puerto drop";
	return section;
}

function sectionDescription(section: string): string {
	if (section === "Cabecera") return "PON, pigtail, ODF";
	if (section === "Mufa / splitter primario") return "Fusion sin conectores";
	if (section === "Distribucion hacia NAP") return "Fibra hasta NAP";
	if (section === "Empalme puntual") return "Evento en ruta";
	if (section === "NAP interna") return "Fusion + splitter";
	if (section === "Puerto NAP") return "Salida al drop";
	return "Tramo optico";
}

function sectionColor(section: string): string {
	if (section === "Cabecera") return "#38d8ff";
	if (section === "Mufa / splitter primario") return "#a78bfa";
	if (section === "Distribucion hacia NAP") return "#8bdff4";
	if (section === "Empalme puntual") return "#fb7185";
	if (section === "NAP interna") return "#f59e0b";
	if (section === "Puerto NAP") return "#f6c768";
	return "#858585";
}

function buildLossEvents(budget: PathBudget): BudgetLossEvent[] {
	if (budget.lossEvents.length > 0) return budget.lossEvents;
	const fallbackEvents: BudgetLossEvent[] = [
		{
			kind: "headend",
			label: "Cabecera OLT / ODF",
			loss: budget.headendLoss,
			section: "Cabecera",
			shortLabel: "Cab.",
		},
		{
			kind: "fiber",
			label: "Fibra",
			loss: budget.fiberLoss,
			section: "Planta externa",
			shortLabel: "Fibra",
		},
		{
			kind: "fusion",
			label: "Fusiones",
			loss: budget.spliceLoss,
			section: "Empalmes",
			shortLabel: "Fusion",
		},
		{
			kind: "splitter",
			label: "Splitters",
			loss: budget.splitterLoss,
			section: "Division optica",
			shortLabel: "Split",
		},
		{
			kind: "connector",
			label: "Conectores",
			loss: budget.connectorLoss,
			section: "Conectores",
			shortLabel: "Con.",
		},
	];
	return fallbackEvents.filter((event) => Math.abs(event.loss) > 0.01);
}

interface SectionGroup {
	color: string;
	description: string;
	events: BudgetLossEvent[];
	id: string;
	key: string;
	loss: number;
	title: string;
}

function buildSectionGroups(events: BudgetLossEvent[]): SectionGroup[] {
	const groups: SectionGroup[] = [];

	for (const event of events) {
		const last = groups.at(-1);
		if (last && last.key === event.section) {
			last.events.push(event);
			last.loss = Math.round((last.loss + event.loss) * 100) / 100;
			continue;
		}

		groups.push({
			color: sectionColor(event.section),
			description: sectionDescription(event.section),
			events: [event],
			id: `${event.section}-${groups.length}-${event.label}`,
			key: event.section,
			loss: Math.round(event.loss * 100) / 100,
			title: sectionTitle(event.section),
		});
	}

	return groups;
}

function buildChartModel(budget: PathBudget) {
	const events = buildLossEvents(budget);
	const labels = new Map<number, string>();
	const data: LineData<UTCTimestamp>[] = [];
	const markers: SeriesMarker<UTCTimestamp>[] = [];

	if (budget.txPowerDbm === null) {
		return { data, events, labels, markers, sections: [] };
	}

	let power = budget.txPowerDbm;
	labels.set(stageTime(0), "Tx");
	data.push({ time: stageTime(0), value: power });

	events.forEach((event, eventIndex) => {
		power -= event.loss;
		const time = stageTime(eventIndex + 1);
		labels.set(time, event.shortLabel);
		data.push({
			color:
				budget.rxPowerDbm !== null && power <= budget.rxPowerDbm
					? "#34d399"
					: undefined,
			time,
			value: power,
		});
		markers.push({
			color: eventColor(event.kind),
			position: "atPriceMiddle",
			price: power,
			shape: eventShape(event.kind),
			size: event.kind === "splitter" ? 0.7 : 0.5,
			time,
		});
	});

	const rxTime = stageTime(events.length + 1);
	labels.set(rxTime, "Rx");
	data.push({
		color: budget.status === "red" ? "#fb4d6d" : "#34d399",
		time: rxTime,
		value: budget.rxPowerDbm ?? power,
	});

	return {
		data,
		events,
		labels,
		markers,
		sections: buildSectionGroups(events),
	};
}

function waterfallY(value: number, min: number, max: number, height: number) {
	const range = Math.max(1, max - min);
	return 18 + ((max - value) / range) * (height - 38);
}

function OpticalPowerBudgetWaterfall({
	budget,
	height,
	model,
}: {
	budget: PathBudget;
	height: number;
	model: ReturnType<typeof buildChartModel>;
}) {
	if (budget.txPowerDbm === null) return null;

	const events = model.events;
	const startPower = budget.txPowerDbm;
	const endPower =
		budget.rxPowerDbm ??
		events.reduce((power, event) => power - event.loss, startPower);
	const values = [startPower];
	let cursor = startPower;
	for (const event of events) {
		cursor -= event.loss;
		values.push(cursor);
	}
	const minPower = Math.min(
		...values,
		endPower,
		budget.rxSensitivityDbm ?? endPower,
	);
	const maxPower = Math.max(...values, startPower);
	const viewWidth = Math.max(720, events.length * 86 + 120);
	const left = 48;
	const right = viewWidth - 34;
	const usable = right - left;
	const step = usable / Math.max(events.length + 1, 1);
	const sensitivityY =
		budget.rxSensitivityDbm !== null
			? waterfallY(budget.rxSensitivityDbm, minPower, maxPower, height)
			: null;

	let power = startPower;
	const segments = events.map((event, index) => {
		const x1 = left + index * step;
		const x2 = left + (index + 1) * step;
		const y1 = waterfallY(power, minPower, maxPower, height);
		const nextPower = power - event.loss;
		const y2 = waterfallY(nextPower, minPower, maxPower, height);
		power = nextPower;
		return { event, index, nextPower, x1, x2, y1, y2 };
	});
	const endX = left + (events.length + 1) * step;
	const endY = waterfallY(endPower, minPower, maxPower, height);
	const startY = waterfallY(startPower, minPower, maxPower, height);

	return (
		<div className="overflow-x-auto px-1.5 pt-1">
			<svg
				aria-label="Waterfall de presupuesto óptico"
				className="min-w-full"
				height={height}
				role="img"
				viewBox={`0 0 ${viewWidth} ${height}`}
			>
				<line
					x1={left - 20}
					x2={right}
					y1={startY}
					y2={startY}
					stroke="#38d8ff"
					strokeDasharray="2 3"
					strokeOpacity="0.55"
				/>
				{sensitivityY !== null && (
					<>
						<line
							x1={left - 20}
							x2={right}
							y1={sensitivityY}
							y2={sensitivityY}
							stroke="#f472b6"
							strokeDasharray="5 5"
							strokeOpacity="0.75"
						/>
						<text
							x={right - 98}
							y={Math.max(12, sensitivityY - 5)}
							fill="#f9a8d4"
							fontSize="9"
							fontWeight="700"
						>
							Sens. {budget.rxSensitivityDbm?.toFixed(1)} dBm
						</text>
					</>
				)}
				<text x={left - 36} y={startY - 5} fill="#8bdff4" fontSize="9">
					Tx {startPower.toFixed(1)}
				</text>
				<line
					x1={left}
					x2={left + step * 0.72}
					y1={startY}
					y2={startY}
					stroke="#34d399"
					strokeLinecap="round"
					strokeWidth="4"
				/>
				{segments.map(({ event, index, nextPower, x1, x2, y1, y2 }) => (
					<g key={`${event.label}-${index}`}>
						<line
							x1={x1 + step * 0.72}
							x2={x2}
							y1={y1}
							y2={y2}
							stroke={eventColor(event.kind)}
							strokeLinecap="round"
							strokeWidth="3"
						/>
						<line
							x1={x2}
							x2={x2}
							y1={y1}
							y2={y2}
							stroke={eventColor(event.kind)}
							strokeOpacity="0.55"
							strokeWidth="2"
						/>
						<line
							x1={x2}
							x2={x2 + step * 0.58}
							y1={y2}
							y2={y2}
							stroke="#34d399"
							strokeLinecap="round"
							strokeWidth="4"
						/>
						<circle cx={x2} cy={y2} fill={eventColor(event.kind)} r="4" />
						<text
							x={x2 + 6}
							y={Math.max(12, y2 - 7)}
							fill={eventColor(event.kind)}
							fontSize="9"
							fontWeight="700"
						>
							-{event.loss.toFixed(1)}
						</text>
						<text
							x={x2 - 22}
							y={height - 8}
							fill="#858585"
							fontSize="9"
							textAnchor="middle"
						>
							{event.shortLabel}
						</text>
						<text
							x={x2 + 6}
							y={Math.min(height - 22, y2 + 16)}
							fill="#b7b7b7"
							fontSize="9"
						>
							{nextPower.toFixed(1)}
						</text>
					</g>
				))}
				<circle
					cx={Math.min(endX, right)}
					cy={endY}
					fill={budget.status === "red" ? "#fb4d6d" : "#34d399"}
					r="4"
				/>
				<text
					x={Math.min(endX + 8, right - 52)}
					y={Math.max(12, endY - 7)}
					fill={budget.status === "red" ? "#fb7185" : "#34d399"}
					fontSize="10"
					fontWeight="800"
				>
					Rx {endPower.toFixed(1)}
				</text>
			</svg>
		</div>
	);
}

export function OpticalPowerBudgetChart({
	budget,
	chartType = "curve",
	className = "",
	height = 220,
	variant = "full",
}: {
	budget: PathBudget | null;
	chartType?: "curve" | "waterfall";
	className?: string;
	height?: number;
	variant?: "compact" | "full";
}) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const model = useMemo(
		() => (budget ? buildChartModel(budget) : null),
		[budget],
	);
	const isCompact = variant === "compact";

	useEffect(() => {
		if (chartType === "waterfall") return;
		const container = containerRef.current;
		if (!container || !budget || !model || model.data.length === 0) return;

		const chart = createChart(container, {
			autoSize: true,
			crosshair: {
				mode: CrosshairMode.Normal,
			},
			grid: {
				horzLines: { color: "rgba(164,164,164,0.08)" },
				vertLines: { color: "rgba(164,164,164,0.06)" },
			},
			height,
			layout: {
				attributionLogo: false,
				background: { color: "transparent", type: ColorType.Solid },
				textColor: "#858585",
			},
			localization: {
				priceFormatter: (price: number) => `${price.toFixed(1)} dBm`,
				timeFormatter: (time: Time) => model.labels.get(Number(time)) ?? "",
			},
			rightPriceScale: {
				borderColor: "rgba(164,164,164,0.12)",
				scaleMargins: {
					bottom: 0.16,
					top: 0.14,
				},
			},
			timeScale: {
				barSpacing: 18,
				borderColor: "rgba(164,164,164,0.12)",
				fixLeftEdge: true,
				fixRightEdge: true,
				rightOffset: 1,
				tickMarkFormatter: (time: Time) => model.labels.get(Number(time)) ?? "",
			},
		});

		const series = chart.addSeries(LineSeries, {
			color: budget.status === "red" ? "#fb4d6d" : "#34d399",
			crosshairMarkerVisible: true,
			lastValueVisible: false,
			lineStyle: LineStyle.Solid,
			lineType: LineType.WithSteps,
			lineWidth: 4,
			pointMarkersRadius: 2,
			pointMarkersVisible: false,
			priceLineVisible: false,
		});

		series.setData(model.data);
		createSeriesMarkers(series, model.markers, {
			autoScale: true,
			zOrder: "top",
		});

		if (budget.rxSensitivityDbm !== null) {
			series.createPriceLine({
				axisLabelVisible: true,
				color: "#f472b6",
				lineStyle: LineStyle.Dashed,
				lineWidth: 2,
				price: budget.rxSensitivityDbm,
				title: "Sensibilidad Rx",
			});
		}

		if (budget.txPowerDbm !== null) {
			series.createPriceLine({
				axisLabelVisible: false,
				color: "#38d8ff",
				lineStyle: LineStyle.Dotted,
				lineWidth: 1,
				price: budget.txPowerDbm,
			});
		}

		chart.timeScale().fitContent();

		return () => chart.remove();
	}, [budget, chartType, height, model]);

	if (!budget || budget.txPowerDbm === null) {
		return (
			<div
				className={`flex items-center justify-center rounded-lg border border-dashed border-white/12 bg-white/[0.025] px-4 text-center text-xs text-[#858585] ${className}`}
				style={{ minHeight: height }}
			>
				Define la potencia Tx de la OLT para graficar el presupuesto óptico.
			</div>
		);
	}
	if (!model) return null;

	if (isCompact) {
		return (
			<div
				className={`overflow-hidden rounded-md border border-white/10 bg-[#0f1112]/92 ${className}`}
			>
				<div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/10 bg-white/[0.018] px-2 py-1.5">
					{model?.sections.map((section) => (
						<div
							key={section.id}
							className="flex min-w-[112px] items-center justify-between gap-2 rounded border border-white/10 bg-[#151718] px-2 py-1"
						>
							<span
								className="min-w-0 truncate text-[8px] font-bold uppercase tracking-[0.1em]"
								style={{ color: section.color }}
							>
								{section.title}
							</span>
							<span
								className="shrink-0 font-mono text-[10px]"
								style={{ color: section.color }}
							>
								-{section.loss.toFixed(1)}
							</span>
						</div>
					))}
				</div>
				{chartType === "waterfall" ? (
					<OpticalPowerBudgetWaterfall
						budget={budget}
						height={height}
						model={model}
					/>
				) : (
					<div className="px-1.5 pt-1">
						<div ref={containerRef} style={{ height }} />
					</div>
				)}
			</div>
		);
	}

	return (
		<div
			className={`overflow-hidden rounded-lg border border-white/10 bg-[#0f1112]/92 ${className}`}
		>
			<div className="flex items-start justify-between gap-3 border-b border-white/10 px-3 py-2.5">
				<div>
					<p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8bdff4]">
						Curva de potencia
					</p>
					<p className="mt-0.5 text-[10px] text-[#777879]">
						Tx - atenuaciones físicas hasta Rx estimado
					</p>
				</div>
				<div className="grid grid-cols-3 gap-1.5 text-right text-[10px]">
					<div className="rounded border border-white/10 bg-white/[0.035] px-2 py-1">
						<p className="text-[#777879]">Tx</p>
						<p className="font-mono text-[#38d8ff]">
							{formatDbm(budget.txPowerDbm)}
						</p>
					</div>
					<div className="rounded border border-white/10 bg-white/[0.035] px-2 py-1">
						<p className="text-[#777879]">Rx</p>
						<p className="font-mono text-[#34d399]">
							{formatDbm(budget.rxPowerDbm)}
						</p>
					</div>
					<div className="rounded border border-white/10 bg-white/[0.035] px-2 py-1">
						<p className="text-[#777879]">Margen</p>
						<p
							className="font-mono"
							style={{
								color:
									budget.margin === null
										? "#858585"
										: budget.margin < 1
											? "#fb4d6d"
											: budget.margin < 3
												? "#f59e0b"
												: "#34d399",
							}}
						>
							{formatDb(budget.margin)}
						</p>
					</div>
				</div>
			</div>
			<div className="border-b border-white/10 bg-white/[0.018] px-3 py-3">
				<div className="flex items-center gap-2 overflow-x-auto pb-1">
					<div className="flex min-w-20 shrink-0 flex-col rounded-md border border-[#38d8ff]/25 bg-[#38d8ff]/8 px-2 py-2">
						<span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#38d8ff]">
							Transmisor
						</span>
						<span className="mt-1 font-mono text-sm text-white">
							{formatDbm(budget.txPowerDbm)}
						</span>
					</div>
					{model?.sections.map((section) => (
						<div
							key={section.id}
							className="group relative min-w-[148px] flex-1 rounded-md border border-white/10 bg-[#151718] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
						>
							<div
								className="absolute inset-x-2 top-0 h-0.5 rounded-full"
								style={{ backgroundColor: section.color }}
							/>
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0">
									<p
										className="truncate text-[9px] font-bold uppercase tracking-[0.14em]"
										style={{ color: section.color }}
									>
										{section.title}
									</p>
									<p className="mt-0.5 truncate text-[9px] text-[#858585]">
										{section.description}
									</p>
								</div>
								<span
									className="shrink-0 font-mono text-[12px]"
									style={{ color: section.color }}
								>
									-{section.loss.toFixed(1)}
								</span>
							</div>
							<div className="mt-2 flex flex-wrap gap-1">
								{section.events.map((event) => (
									<span
										key={`${event.label}-${event.loss}`}
										className="inline-flex items-center gap-1 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[9px] text-[#b7b7b7]"
										title={event.label}
									>
										<span
											className="size-1 rounded-full"
											style={{ backgroundColor: eventColor(event.kind) }}
										/>
										<span className="max-w-16 truncate">
											{event.shortLabel}
										</span>
										<span className="font-mono text-[#858585]">
											{event.loss.toFixed(1)}
										</span>
									</span>
								))}
							</div>
						</div>
					))}
					<div className="flex min-w-20 shrink-0 flex-col rounded-md border border-[#34d399]/25 bg-[#34d399]/8 px-2 py-2">
						<span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#34d399]">
							Receptor
						</span>
						<span className="mt-1 font-mono text-sm text-white">
							{formatDbm(budget.rxPowerDbm)}
						</span>
					</div>
				</div>
			</div>
			<div className="px-2 pt-2">
				<div ref={containerRef} style={{ height }} />
			</div>
			<div className="grid grid-cols-2 gap-1.5 border-t border-white/10 p-2 text-[10px] sm:grid-cols-4">
				<div className="rounded border border-white/10 bg-white/[0.035] px-2 py-1.5">
					<p className="text-[#777879]">Perdida fisica</p>
					<p className="font-mono text-white">
						{formatDb(budget.physicalLoss)}
					</p>
				</div>
				<div className="rounded border border-white/10 bg-white/[0.035] px-2 py-1.5">
					<p className="text-[#777879]">Reserva diseno</p>
					<p className="font-mono text-white">
						{formatDb(budget.safetyMargin)}
					</p>
				</div>
				<div className="rounded border border-white/10 bg-white/[0.035] px-2 py-1.5">
					<p className="text-[#777879]">Sensibilidad Rx</p>
					<p className="font-mono text-[#f472b6]">
						{formatDbm(budget.rxSensitivityDbm)}
					</p>
				</div>
				<div className="rounded border border-white/10 bg-white/[0.035] px-2 py-1.5">
					<p className="text-[#777879]">Margen diseno</p>
					<p
						className="font-mono"
						style={{
							color:
								budget.designPowerMarginDb === null
									? "#858585"
									: budget.designPowerMarginDb < 1
										? "#fb4d6d"
										: budget.designPowerMarginDb < 3
											? "#f59e0b"
											: "#34d399",
						}}
					>
						{formatDb(budget.designPowerMarginDb)}
					</p>
				</div>
			</div>
		</div>
	);
}
