"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/feedback/toast";
import { normalizeZoneCode } from "@/lib/gpon/operative-code";
import {
	createNetworkZone,
	fetchNetworkZones,
	networkEditorKeys,
} from "@/lib/queries/network-editor";
import { translateDbError } from "@/lib/supabase/errors";

interface Props {
	networkId: string;
	/** Selected zone code, or null while none is chosen yet. */
	value: string | null;
	onChange: (zoneCode: string | null) => void;
	/** admin / network_engineer: RLS lets them create zones. */
	canManage: boolean;
	/** Zone used most in the network's existing codes (default candidate). */
	preferredZone: string | null;
}

const SELECT_CLASS =
	"h-9 w-full rounded-lg border border-border bg-surface-sunken px-2.5 text-sm text-fg outline-none transition-colors focus-visible:border-info/50 focus-visible:ring-3 focus-visible:ring-info/20 disabled:opacity-50";

/**
 * Operational zone for generated codes ({PROV}-{CIUDAD}-{ZONA}-{TIPO}-{SEQ}).
 * Zones come from `network_zones`; the last one used is remembered per network
 * in this browser.
 */
export function ZoneField({
	networkId,
	value,
	onChange,
	canManage,
	preferredZone,
}: Props) {
	const queryClient = useQueryClient();
	const id = useId();
	const storageKey = `gpon:capture-zone:${networkId}`;
	const zonesQuery = useQuery({
		queryKey: networkEditorKeys.zones(networkId),
		queryFn: () => fetchNetworkZones(networkId),
	});
	const zones = zonesQuery.data ?? [];
	const zoneCodes = zones.map((zone) => zone.zone_code);

	const [formOpen, setFormOpen] = useState(false);
	const [newCode, setNewCode] = useState("");
	const [newName, setNewName] = useState("");
	const [formError, setFormError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [manualDraft, setManualDraft] = useState(value ?? "");

	const select = (code: string | null) => {
		onChange(code);
		if (!code) return;
		try {
			localStorage.setItem(storageKey, code);
		} catch {
			// Storage unavailable (private mode): the choice just isn't remembered.
		}
	};

	// Pick a default once the zones are known: last used here → most used in
	// the network's codes → first zone.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the zone list arrives; `select` is stable enough for this one-shot default.
	useEffect(() => {
		if (!zonesQuery.isSuccess || zoneCodes.length === 0) return;
		if (value && zoneCodes.includes(value)) return;
		let stored: string | null = null;
		try {
			stored = localStorage.getItem(storageKey);
		} catch {
			stored = null;
		}
		const pick =
			[stored, preferredZone].find(
				(code): code is string => !!code && zoneCodes.includes(code),
			) ?? zoneCodes[0];
		select(pick);
	}, [zonesQuery.isSuccess, zoneCodes.join("|"), preferredZone]);

	const submitZone = async () => {
		const code = normalizeZoneCode(newCode);
		if (!code) {
			setFormError("Usa de 2 a 6 letras o números, sin guiones (ej. Z05).");
			return;
		}
		if (zoneCodes.includes(code)) {
			setFormError(`La zona ${code} ya existe en esta red.`);
			return;
		}
		if (!newName.trim()) {
			setFormError("Ponle un nombre (ej. Centro, Sector norte).");
			return;
		}
		setSaving(true);
		setFormError(null);
		try {
			await createNetworkZone({
				networkId,
				zoneCode: code,
				zoneName: newName.trim(),
			});
			await queryClient.invalidateQueries({
				queryKey: networkEditorKeys.zones(networkId),
			});
			select(code);
			toast({ tone: "success", title: `Zona ${code} creada` });
			setFormOpen(false);
			setNewCode("");
			setNewName("");
		} catch (error) {
			console.error("create_network_zone failed", error);
			setFormError(
				translateDbError(
					error,
					"No se pudo crear la zona. Inténtalo de nuevo.",
				),
			);
		} finally {
			setSaving(false);
		}
	};

	// These inputs sit inside the capture <form>: Enter must create the zone,
	// not submit the placement form.
	const onNewZoneKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		void submitZone();
	};

	const hasZones = zones.length > 0;

	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between gap-2">
				<label
					htmlFor={`${id}-zone`}
					className="text-[11px] font-semibold uppercase tracking-widest text-fg-muted"
				>
					Zona
				</label>
				{canManage && !formOpen && zonesQuery.isSuccess && (
					<button
						type="button"
						onClick={() => {
							setFormOpen(true);
							setFormError(null);
						}}
						className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-info-fg transition-colors hover:bg-info/10"
					>
						<Plus className="size-3" aria-hidden="true" />
						Nueva zona
					</button>
				)}
			</div>

			{zonesQuery.isPending ? (
				<select id={`${id}-zone`} disabled className={SELECT_CLASS}>
					<option>Cargando zonas…</option>
				</select>
			) : hasZones ? (
				<select
					id={`${id}-zone`}
					value={value ?? ""}
					onChange={(event) => select(event.target.value || null)}
					className={SELECT_CLASS}
				>
					{zones.map((zone) => (
						<option key={zone.id} value={zone.zone_code}>
							{zone.zone_code} · {zone.zone_name}
						</option>
					))}
				</select>
			) : (
				// No zones (or they failed to load): manual code so capture isn't blocked.
				<>
					<Input
						id={`${id}-zone`}
						value={manualDraft}
						placeholder="Z05"
						maxLength={6}
						onChange={(event) => {
							setManualDraft(event.target.value);
							onChange(normalizeZoneCode(event.target.value));
						}}
						aria-invalid={manualDraft !== "" && value === null}
					/>
					<p className="text-[11px] leading-5 text-fg-muted">
						{zonesQuery.isError
							? "No se pudieron cargar las zonas; escribe el código a mano."
							: canManage
								? "Esta red no tiene zonas: escribe una o créala para reutilizarla."
								: "Esta red no tiene zonas: escribe el código o pide a ingeniería que las cree."}
					</p>
				</>
			)}

			{formOpen && (
				<div className="space-y-2 rounded-lg border border-border-subtle bg-surface-sunken p-2.5">
					<div className="grid grid-cols-[5.5rem_1fr] gap-2">
						<Input
							aria-label="Código de zona"
							onKeyDown={onNewZoneKeyDown}
							placeholder="Z07"
							maxLength={6}
							value={newCode}
							onChange={(event) => setNewCode(event.target.value.toUpperCase())}
						/>
						<Input
							aria-label="Nombre de la zona"
							onKeyDown={onNewZoneKeyDown}
							placeholder="Sector norte"
							value={newName}
							onChange={(event) => setNewName(event.target.value)}
						/>
					</div>
					{formError && (
						<p role="alert" className="text-[11px] text-danger-fg">
							{formError}
						</p>
					)}
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								setFormOpen(false);
								setFormError(null);
							}}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							variant="info"
							size="sm"
							disabled={saving}
							onClick={() => void submitZone()}
						>
							{saving ? "Creando…" : "Crear zona"}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
