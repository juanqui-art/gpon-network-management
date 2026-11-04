"use client";

import { useState } from "react";
import {
	generateTopology,
	listTopologyTemplates,
	TOPOLOGY_CONFIGS,
	type TopologyTemplate,
} from "@/lib/gpon/topology-templates";

interface TopologyPickerProps {
	onSelect?: (topologyId: TopologyTemplate) => void;
	onGenerate?: (data: ReturnType<typeof generateTopology>) => void;
}

export function TopologyPicker({ onSelect, onGenerate }: TopologyPickerProps) {
	const [selectedTemplate, setSelectedTemplate] =
		useState<TopologyTemplate | null>(null);
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
				<h2 className="mb-4 text-balance text-lg font-bold text-foreground">
					Selecciona una topología GPON
				</h2>
				<p className="text-xs text-fg-secondary mb-6">
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
								? "border-info bg-info/10"
								: "border-border bg-surface-panel/50 hover:border-tint"
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
						<h3 className="text-sm font-semibold text-fg text-left mb-1">
							{config.name}
						</h3>

						{/* Description */}
						<p className="text-xs text-fg-muted text-left mb-3 line-clamp-2">
							{config.description}
						</p>

						{/* Details */}
						<div className="space-y-1 text-left">
							<div className="text-[10px] text-fg-secondary">
								<strong>Cobertura:</strong> {config.estimatedCoverage}
							</div>
							<div className="text-[10px] text-fg-secondary">
								<strong>NAPs:</strong> {config.napsByRegion}
							</div>
							<div className="text-[10px] text-fg-secondary">
								<strong>Fibra:</strong> {config.fiberEstimate}
							</div>
						</div>

						{/* Badge */}
						{selectedTemplate === id && (
							<div className="mt-3 px-2 py-1 bg-info text-surface text-[10px] font-bold rounded w-fit">
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
						className="w-full px-4 py-2.5 bg-info text-surface font-semibold rounded-lg hover:bg-[#22d3ee] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{isGenerating ? "Generando..." : "Generar Topología"}
					</button>
					<p className="text-xs text-fg-muted">
						Se crearán automáticamente{" "}
						{TOPOLOGY_CONFIGS[selectedTemplate].napsByRegion} NAPs, splitters y
						rutas.
					</p>
				</div>
			)}

			{selectedTemplate === "blank" && (
				<div className="p-3 bg-[#a78bfa]/10 border border-[#a78bfa]/30 rounded-lg">
					<p className="text-xs text-fg-soft">
						✎ Modo manual: dibuja tu topología personalizando cada elemento y
						ruta.
					</p>
				</div>
			)}
		</div>
	);
}
