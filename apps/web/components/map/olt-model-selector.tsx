"use client";

import { useState } from "react";
import {
	OLT_CATALOG,
	OLT_MANUFACTURERS,
	type OltModel,
} from "@/lib/gpon/olt-catalog";

interface OltModelSelectorProps {
	onSelect: (model: OltModel) => void;
	selectedOpticalClass?: string | null;
}

export function OltModelSelector({
	onSelect,
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
				<legend className="text-xs font-medium text-[#d7d7d7]">Marca</legend>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => setFilterManufacturer(null)}
						className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
							filterManufacturer === null
								? "bg-[#38bdf8] text-[#1b1c1d]"
								: "border border-[rgba(164,164,164,0.18)] bg-transparent text-[#a4a4a4] hover:border-[#a4a4a4]"
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
									? "bg-[#38bdf8] text-[#1b1c1d]"
									: "border border-[rgba(164,164,164,0.18)] bg-transparent text-[#a4a4a4] hover:border-[#a4a4a4]"
							}`}
						>
							{mfr}
						</button>
					))}
				</div>
			</fieldset>

			{/* Models grid */}
			<fieldset className="space-y-2">
				<legend className="text-xs font-medium text-[#d7d7d7]">
					Modelo OLT
				</legend>
				<div className="grid gap-2">
					{filteredModels.map((model) => {
						const isSelected = selectedOpticalClass === model.opticalClass;
						return (
							<button
								key={model.id}
								type="button"
								onClick={() => onSelect(model)}
								className={`rounded-md border p-3 text-left transition-colors ${
									isSelected
										? "border-[#38bdf8] bg-[rgba(56,189,248,0.1)]"
										: "border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)] hover:border-[rgba(164,164,164,0.18)]"
								}`}
							>
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
										<div className="text-xs font-semibold text-[#e6e6e6]">
											{model.manufacturer} {model.model}
										</div>
										<div className="mt-1 text-[10px] text-[#777879]">
											{model.notes}
										</div>
									</div>
									<div className="flex shrink-0 flex-col items-end gap-1 text-right">
										<div className="rounded-sm bg-[#34d399]/20 px-2 py-1 text-[9px] font-semibold text-[#34d399]">
											{model.opticalClass}
										</div>
										<div className="text-[9px] text-[#a4a4a4]">
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
