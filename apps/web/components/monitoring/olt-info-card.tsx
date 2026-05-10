"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	propertyNumber,
	propertyString,
	splitRatioCapacity,
} from "@/lib/gpon/olt-properties";
import { cn } from "@/lib/utils";

export interface OltInfoCardProps {
	host: string;
	code: string | null;
	status: string;
	opticalClass: string | null;
	totalPonPorts: number | null;
	properties: Record<string, unknown>;
}

const STATUS_VARIANT: Record<
	string,
	"default" | "secondary" | "destructive" | "outline"
> = {
	active: "default",
	planned: "outline",
	inactive: "secondary",
	faulty: "destructive",
	retired: "outline",
};

const STATUS_LABEL: Record<string, string> = {
	active: "Activa",
	planned: "Planificada",
	inactive: "Inactiva",
	faulty: "Con falla",
	retired: "Retirada",
};

export function OltInfoCard({
	host,
	code,
	status,
	opticalClass,
	totalPonPorts,
	properties,
}: OltInfoCardProps) {
	const [expanded, setExpanded] = useState(false);

	const model = propertyString(properties, "olt_model", "Modelo no definido");
	const manufacturer =
		propertyString(properties, "olt_manufacturer") ||
		propertyString(properties, "olt_brand");

	const serviceCards = propertyNumber(properties, "service_cards_installed");
	const slotsTotal = propertyNumber(properties, "service_slots_total");
	const ponPerCard = propertyNumber(properties, "pon_ports_per_card");
	const designSplit = propertyString(properties, "design_split_ratio");
	const splitCapacity = splitRatioCapacity(designSplit);
	const estimatedSubs =
		propertyNumber(properties, "estimated_subscribers") ??
		(totalPonPorts !== null && splitCapacity !== null
			? totalPonPorts * splitCapacity
			: null);

	const txPower = propertyNumber(properties, "tx_power_dbm");
	const rxSensitivity = propertyNumber(properties, "rx_sensitivity_dbm");
	const headendLoss = propertyNumber(properties, "headend_loss_db");
	const headendPatchcord = propertyString(properties, "headend_patchcord_type");
	const ponConnector = propertyString(properties, "pon_port_connector_type");
	const odfConnector = propertyString(properties, "odf_feeder_connector_type");

	return (
		<div className="rounded-lg border border-border bg-card">
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
			>
				<div className="flex min-w-0 items-center gap-3">
					<span
						aria-hidden
						className={cn(
							"inline-block w-3 select-none text-xs text-muted-foreground transition-transform",
							expanded && "rotate-90",
						)}
					>
						▶
					</span>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-sm font-medium text-foreground">
								Información del equipo
							</span>
							<Badge
								variant={STATUS_VARIANT[status] ?? "outline"}
								className="text-[10px]"
							>
								{STATUS_LABEL[status] ?? status}
							</Badge>
						</div>
						<p className="mt-0.5 truncate text-xs text-muted-foreground">
							{model}{" "}
							{manufacturer && model !== manufacturer
								? `· ${manufacturer}`
								: ""}
							{code ? ` · ${code}` : ""}
						</p>
					</div>
				</div>
				<span className="shrink-0 font-mono text-[10px] text-muted-foreground">
					{host}
				</span>
			</button>
			{expanded && (
				<div className="border-t border-border px-4 py-3">
					<div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
						<InfoRow label="Modelo" value={model} />
						{manufacturer && <InfoRow label="Marca" value={manufacturer} />}
						{code && <InfoRow label="Código" value={code} mono />}
						<InfoRow label="Clase óptica" value={opticalClass ?? "—"} />
						<InfoRow
							label="Tx OLT"
							value={txPower !== null ? `${txPower.toFixed(1)} dBm` : "—"}
						/>
						<InfoRow
							label="Sensibilidad Rx"
							value={
								rxSensitivity !== null ? `${rxSensitivity.toFixed(1)} dBm` : "—"
							}
						/>
						<InfoRow
							label="Pérdida cabecera"
							value={
								headendLoss !== null ? `${headendLoss.toFixed(1)} dB` : "—"
							}
						/>
						<InfoRow
							label="Tarjetas instaladas"
							value={
								serviceCards !== null && slotsTotal !== null
									? `${serviceCards} / ${slotsTotal}`
									: serviceCards !== null
										? String(serviceCards)
										: "—"
							}
						/>
						<InfoRow
							label="Puertos PON"
							value={
								totalPonPorts !== null &&
								ponPerCard !== null &&
								serviceCards !== null
									? `${totalPonPorts} (${serviceCards} × ${ponPerCard})`
									: totalPonPorts !== null
										? String(totalPonPorts)
										: "—"
							}
						/>
						{designSplit && (
							<InfoRow label="Split diseño" value={designSplit} />
						)}
						{estimatedSubs !== null && (
							<InfoRow
								label="Suscriptores est."
								value={estimatedSubs.toLocaleString("es-EC")}
							/>
						)}
						{ponConnector && (
							<InfoRow label="Conector PON" value={ponConnector} mono />
						)}
						{odfConnector && (
							<InfoRow label="Conector ODF" value={odfConnector} mono />
						)}
						{headendPatchcord && (
							<InfoRow
								label="Patchcord cabecera"
								value={headendPatchcord}
								mono
							/>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function InfoRow({
	label,
	value,
	mono = false,
}: {
	label: string;
	value: string;
	mono?: boolean;
}) {
	return (
		<div className="flex items-baseline justify-between gap-3 text-xs">
			<span className="text-muted-foreground">{label}</span>
			<span className={cn("text-right text-foreground", mono && "font-mono")}>
				{value}
			</span>
		</div>
	);
}
