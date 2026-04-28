"use client";

import {
	TOPOLOGY_CONFIGS,
	generateTopology,
	listTopologyTemplates,
	type TopologyTemplate,
} from "@/lib/gpon/topology-templates";
import { useState } from "react";

interface TopologyPickerProps {
	onSelect?: (topologyId: TopologyTemplate) => void;
	onGenerate?: (data: ReturnType<typeof generateTopology>) => void;
}

export function TopologyPicker({ onSelect, onGenerate }: TopologyPickerProps) {
	const [selectedTemplate, setSelectedTemplate] = useState<TopologyTemplate | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);

	const templates = listTopologyTemplates();

	const handleSelect = (templateId: TopologyTemplate) => {
		setSelectedTemplate(templateId);
		onSelect?.(templateId);
	};

	const handleGenerate = () => {
		if (!selectedTemplate) return;
		setIsGenerating(true);
		try {
			const topology = generateTopology(selectedTemplate);
			onGenerate?.(topology);
		} finally {
			setIsGenerating(false);
		}
	};

	return (
		<div className="w-full space-y-6">
			<div>
				<h2 className="text-lg font-bold text-[#e6e6e6] mb-4">
					Selecciona una topología GPON
				</h2>
				<p className="text-xs text-[#a4a4a4] mb-6">
					Basadas en investigación de despliegues ecuatorianos.
				</p>
			</div>

			{/* Templates Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{templates.map(({ id, config }) => (
					<button
						key={id}
						onClick={() => handleSelect(id)}
						className={`p-4 rounded-lg border transition-all ${
							selectedTemplate === id
								? "border-[#38bdf8] bg-[#38bdf8]/10"
								: "border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.5)] hover:border-[#a4a4a4]"
						}`}
						type="button"
					>
						{/* Icon */}
						<div className="mb-3 text-2xl">
							{id === "star" && "⭐"}
							{id === "tree" && "🌳"}
							{id === "cascade" && "🔄"}
							{id === "blank" && "⬜"}
						</div>

						{/* Name */}
						<h3 className="text-sm font-semibold text-[#e6e6e6] text-left mb-1">
							{config.name}
						</h3>

						{/* Description */}
						<p className="text-xs text-[#777879] text-left mb-3 line-clamp-2">
							{config.description}
						</p>

						{/* Details */}
						<div className="space-y-1 text-left">
							<div className="text-[10px] text-[#a4a4a4]">
								<strong>Cobertura:</strong> {config.estimatedCoverage}
							</div>
							<div className="text-[10px] text-[#a4a4a4]">
								<strong>NAPs:</strong> {config.napsByRegion}
							</div>
							<div className="text-[10px] text-[#a4a4a4]">
								<strong>Fibra:</strong> {config.fiberEstimate}
							</div>
						</div>

						{/* Badge */}
						{selectedTemplate === id && (
							<div className="mt-3 px-2 py-1 bg-[#38bdf8] text-[#1b1c1d] text-[10px] font-bold rounded w-fit">
								✓ Seleccionado
							</div>
						)}
					</button>
				))}
			</div>

			{/* Generate Button */}
			{selectedTemplate && selectedTemplate !== "blank" && (
				<div className="space-y-2">
					<button
						onClick={handleGenerate}
						disabled={isGenerating}
						type="button"
						className="w-full px-4 py-2.5 bg-[#38bdf8] text-[#1b1c1d] font-semibold rounded-lg hover:bg-[#22d3ee] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{isGenerating ? "Generando..." : "Generar Topología"}
					</button>
					<p className="text-xs text-[#777879]">
						Se crearán automáticamente {TOPOLOGY_CONFIGS[selectedTemplate].napsByRegion} NAPs,
						splitters y rutas.
					</p>
				</div>
			)}

			{selectedTemplate === "blank" && (
				<div className="p-3 bg-[#a78bfa]/10 border border-[#a78bfa]/30 rounded-lg">
					<p className="text-xs text-[#d7d7d7]">
						✎ Modo manual: dibuja tu topología personalizando cada elemento y ruta.
					</p>
				</div>
			)}
		</div>
	);
}
