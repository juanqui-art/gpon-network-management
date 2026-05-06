import {
	propertyNumber,
	propertyString,
	splitRatioCapacity,
} from "@/lib/gpon/olt-properties";

interface OltTechnicalEditorProps {
	properties: Record<string, unknown>;
	totalPonPorts: number | null;
	onPropertiesChange: (properties: Record<string, unknown>) => void;
	onTotalPonPortsChange: (value: number | null) => void;
}

export function OltTechnicalEditor({
	properties,
	totalPonPorts,
	onPropertiesChange,
	onTotalPonPortsChange,
}: OltTechnicalEditorProps) {
	const serviceCards = propertyNumber(properties, "service_cards_installed");
	const ponPortsPerCard = propertyNumber(properties, "pon_ports_per_card");
	const designSplitRatio = propertyString(
		properties,
		"design_split_ratio",
		"1:128",
	);
	const installedPonPorts =
		serviceCards !== null && ponPortsPerCard !== null
			? serviceCards * ponPortsPerCard
			: totalPonPorts;
	const splitCapacity = splitRatioCapacity(designSplitRatio);
	const estimatedSubscribers =
		installedPonPorts !== null && splitCapacity !== null
			? installedPonPorts * splitCapacity
			: propertyNumber(properties, "estimated_subscribers");

	const setProperty = (key: string, value: unknown) => {
		onPropertiesChange({ ...properties, [key]: value });
	};
	const setProperties = (nextProperties: Record<string, unknown>) => {
		onPropertiesChange({ ...properties, ...nextProperties });
	};

	return (
		<div className="space-y-3 rounded-lg border border-[rgba(56,189,248,0.18)] bg-[rgba(56,189,248,0.055)] p-3">
			<div>
				<p className="text-[10px] font-semibold uppercase tracking-widest text-[#7dd3fc]">
					Inventario OLT
				</p>
				<p className="mt-1 text-[11px] leading-4 text-[#8f969e]">
					Referencia realista tipo ZTE C300: 7 tarjetas de 14, 16 PON por
					tarjeta y cabecera óptica documentada.
				</p>
			</div>
			<div className="grid grid-cols-2 gap-2">
				<TechnicalNumberInput
					label="Tarjetas servicio"
					value={serviceCards}
					onChange={(value) => {
						const portsPerCard =
							propertyNumber(properties, "pon_ports_per_card") ?? 16;
						const nextTotal = value === null ? null : value * portsPerCard;
						const split = splitRatioCapacity(designSplitRatio);
						onTotalPonPortsChange(nextTotal);
						setProperties({
							service_cards_installed: value,
							estimated_subscribers:
								nextTotal !== null && split !== null ? nextTotal * split : null,
						});
					}}
				/>
				<TechnicalNumberInput
					label="Slots máximos"
					value={propertyNumber(properties, "service_slots_total")}
					onChange={(value) => setProperty("service_slots_total", value)}
				/>
				<TechnicalNumberInput
					label="PON por tarjeta"
					value={ponPortsPerCard}
					onChange={(value) => {
						const nextTotal =
							serviceCards === null || value === null
								? null
								: serviceCards * value;
						const split = splitRatioCapacity(designSplitRatio);
						onTotalPonPortsChange(nextTotal);
						setProperties({
							pon_ports_per_card: value,
							estimated_subscribers:
								nextTotal !== null && split !== null ? nextTotal * split : null,
						});
					}}
				/>
				<TechnicalNumberInput
					label="PON instalados"
					value={totalPonPorts}
					onChange={onTotalPonPortsChange}
				/>
			</div>
			<label className="block">
				<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
					Split de diseño
				</span>
				<select
					value={designSplitRatio}
					onChange={(event) => {
						const value = event.target.value;
						const split = splitRatioCapacity(value);
						setProperties({
							design_split_ratio: value,
							estimated_subscribers:
								installedPonPorts !== null && split !== null
									? installedPonPorts * split
									: null,
						});
					}}
					className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
				>
					<option value="1:32">1:32</option>
					<option value="1:64">1:64</option>
					<option value="1:128">1:128</option>
				</select>
			</label>
			<TechnicalProperty
				label="Clientes estimados"
				value={estimatedSubscribers?.toLocaleString("es-EC") ?? "-"}
			/>
			<div className="h-px bg-[rgba(164,164,164,0.1)]" />
			<div>
				<p className="text-[10px] font-semibold uppercase tracking-widest text-[#7dd3fc]">
					Potencia óptica
				</p>
				<p className="mt-1 text-[11px] leading-4 text-[#8f969e]">
					El unifilar usa estos valores para estimar potencia recibida y margen
					real: Rx = Tx OLT - pérdidas físicas.
				</p>
			</div>
			<div className="grid grid-cols-2 gap-2">
				<TechnicalNumberInput
					label="Tx OLT dBm"
					value={propertyNumber(properties, "tx_power_dbm")}
					step="0.1"
					onChange={(value) => setProperty("tx_power_dbm", value)}
				/>
				<TechnicalNumberInput
					label="Sensibilidad Rx"
					value={propertyNumber(properties, "rx_sensitivity_dbm")}
					step="0.1"
					onChange={(value) => setProperty("rx_sensitivity_dbm", value)}
				/>
				<TechnicalNumberInput
					label="Pérdida cabecera"
					value={propertyNumber(properties, "headend_loss_db")}
					step="0.1"
					onChange={(value) => setProperty("headend_loss_db", value)}
				/>
				<TechnicalNumberInput
					label="Adaptadores"
					value={propertyNumber(properties, "headend_adapter_count")}
					onChange={(value) => setProperty("headend_adapter_count", value)}
				/>
				<TechnicalTextInput
					label="Puerto PON"
					value={propertyString(
						properties,
						"pon_port_connector_type",
						"SC/UPC",
					)}
					onChange={(value) => setProperty("pon_port_connector_type", value)}
				/>
				<TechnicalTextInput
					label="ODF / feeder"
					value={propertyString(
						properties,
						"odf_feeder_connector_type",
						"SC/APC",
					)}
					onChange={(value) => setProperty("odf_feeder_connector_type", value)}
				/>
			</div>
			<TechnicalTextInput
				label="Patchcord cabecera"
				value={propertyString(
					properties,
					"headend_patchcord_type",
					"SC/UPC -> SC/APC",
				)}
				onChange={(value) => setProperty("headend_patchcord_type", value)}
			/>
		</div>
	);
}

function TechnicalTextInput({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
				{label}
			</span>
			<input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
			/>
		</label>
	);
}

function TechnicalNumberInput({
	label,
	value,
	step = "1",
	onChange,
}: {
	label: string;
	value: number | null;
	step?: string;
	onChange: (value: number | null) => void;
}) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
				{label}
			</span>
			<input
				type="number"
				step={step}
				value={value ?? ""}
				onChange={(event) =>
					onChange(
						event.target.value === "" ? null : Number(event.target.value),
					)
				}
				className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
			/>
		</label>
	);
}

function TechnicalProperty({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-3">
			<span className="text-xs text-[#777879]">{label}</span>
			<span className="truncate text-right font-mono text-xs text-[#d7d7d7]">
				{value}
			</span>
		</div>
	);
}
