"use client";

import { useState } from "react";
import {
	OLT_CATALOG,
	OLT_MANUFACTURERS,
	type OltModel,
} from "@/lib/gpon/olt-catalog";

interface OltModelSelectorProps {
	onSelect: (model: OltModel) => void;
	selectedModelId?: string | null;
	selectedOpticalClass?: string | null;
}

export function OltModelSelector({
	onSelect,
	selectedModelId,
	selectedOpticalClass,
}: OltModelSelectorProps) {
	const [filterManufacturer, setFilterManufacturer] = useState<string | null>(
		null,
	);

	const filteredModels = filterManufacturer
		? Object.values(OLT_CATALOG).filter(
				(m) => m.manufacturer === filterManufacturer,
			)
		: Object.values(OLT_CATALOG);

	return (
		<div className="space-y-3">
			{/* Manufacturer filter */}
			<fieldset className="space-y-2">
				<legend className="text-xs font-medium text-fg-soft">Marca</legend>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => setFilterManufacturer(null)}
						className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
							filterManufacturer === null
								? "bg-info text-surface"
								: "border border-border bg-transparent text-fg-secondary hover:border-tint"
						}`}
					>
						Todas
					</button>
					{OLT_MANUFACTURERS.map((mfr) => (
						<button
							key={mfr}
							type="button"
							onClick={() => setFilterManufacturer(mfr)}
							className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
								filterManufacturer === mfr
									? "bg-info text-surface"
									: "border border-border bg-transparent text-fg-secondary hover:border-tint"
							}`}
						>
							{mfr}
						</button>
					))}
				</div>
			</fieldset>

			{/* Models grid */}
			<fieldset className="space-y-2">
				<legend className="text-xs font-medium text-fg-soft">Modelo OLT</legend>
				<div className="grid gap-2">
					{filteredModels.map((model) => {
						const isSelected = selectedModelId
							? selectedModelId === model.id
							: selectedOpticalClass === model.opticalClass;
						return (
							<button
								key={model.id}
								type="button"
								onClick={() => onSelect(model)}
								className={`rounded-md border p-3 text-left transition-colors ${
									isSelected
										? "border-info bg-info/10"
										: "border-border-subtle bg-tint/5 hover:border-border"
								}`}
							>
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
										<div className="text-xs font-semibold text-fg">
											{model.manufacturer} {model.model}
										</div>
										<div className="mt-1 text-[10px] text-fg-muted">
											{model.notes}
										</div>
									</div>
									<div className="flex shrink-0 flex-col items-end gap-1 text-right">
										<div className="rounded-sm bg-success/20 px-2 py-1 text-[10px] font-semibold text-success">
											{model.opticalClass}
										</div>
										<div className="text-[10px] text-fg-secondary">
											{model.maxPonPorts}x PON
										</div>
									</div>
								</div>
							</button>
						);
					})}
				</div>
			</fieldset>
		</div>
	);
}
