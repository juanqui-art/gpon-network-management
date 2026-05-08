import type { ReactElement } from "react";

export const EQUIPMENT_TYPE_LABEL: Record<string, string> = {
	olt: "OLT",
	splitter: "Splitter",
	closure: "Mufa",
	nap: "NAP",
	ont: "ONT",
	unknown: "Equipo",
};

export const EQUIPMENT_STATUS_LABEL: Record<string, string> = {
	online: "En línea",
	active: "Activo",
	planned: "Planificado",
	inactive: "Inactivo",
	faulty: "Falla",
	retired: "Retirado",
	alarm: "Alarma",
	offline: "Fuera de línea",
	maintenance: "Mantenimiento",
	decommissioned: "Retirado",
	unknown: "Sin estado",
};

export const EQUIPMENT_STATUS_MARK: Record<string, string> = {
	online: "",
	active: "",
	planned: "P",
	inactive: "-",
	faulty: "!",
	retired: "x",
	alarm: "!",
	offline: "x",
	maintenance: "•",
	decommissioned: "-",
	unknown: "?",
};

export const EQUIPMENT_MARKER_SIZE: Record<string, number> = {
	olt: 38,
	splitter: 30,
	nap: 28,
	closure: 30,
	ont: 22,
};

function normalizedType(
	type: string,
): "olt" | "splitter" | "closure" | "nap" | "ont" {
	if (
		type === "olt" ||
		type === "splitter" ||
		type === "closure" ||
		type === "nap"
	)
		return type;
	return "ont";
}

export function equipmentSymbolSvg(
	type: string,
	color: string,
	options: { hasInternalSplitter?: boolean } = {},
): string {
	const c = color;
	switch (normalizedType(type)) {
		case "olt":
			return `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
        <rect x="4" y="5" width="30" height="28" rx="4" fill="${c}"/>
        <rect x="8" y="9" width="22" height="5" rx="1.5" fill="white" opacity="0.18"/>
        <rect x="8" y="17" width="22" height="5" rx="1.5" fill="white" opacity="0.18"/>
        <rect x="8" y="25" width="22" height="4" rx="1.5" fill="white" opacity="0.18"/>
        <rect x="10" y="11" width="12" height="1.6" rx="0.8" fill="white" opacity="0.88"/>
        <rect x="10" y="19" width="12" height="1.6" rx="0.8" fill="white" opacity="0.88"/>
        <rect x="10" y="26.2" width="12" height="1.6" rx="0.8" fill="white" opacity="0.88"/>
        <circle cx="27" cy="11.8" r="1.5" fill="white" opacity="0.95"/>
        <circle cx="27" cy="19.8" r="1.5" fill="white" opacity="0.95"/>
      </svg>`;
		case "splitter":
			return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
        <path d="M4 5.5 Q4 4.3 5.1 4.9 L25.4 14 Q27 14.8 25.4 16 L5.1 25.1 Q4 25.7 4 24.5 Z" fill="${c}"/>
        <circle cx="8" cy="15" r="2.2" fill="white" opacity="0.96"/>
        <path d="M11.2 15 H17.2" stroke="white" stroke-width="1.7" stroke-linecap="round" opacity="0.9"/>
        <path d="M17.2 15 L24 9" stroke="white" stroke-width="1.65" stroke-linecap="round" opacity="0.72"/>
        <path d="M17.2 15 H24.6" stroke="white" stroke-width="1.65" stroke-linecap="round" opacity="0.86"/>
        <path d="M17.2 15 L24 21" stroke="white" stroke-width="1.65" stroke-linecap="round" opacity="0.72"/>
        <circle cx="24.5" cy="9" r="1.15" fill="white" opacity="0.82"/>
        <circle cx="25" cy="15" r="1.15" fill="white" opacity="0.92"/>
        <circle cx="24.5" cy="21" r="1.15" fill="white" opacity="0.82"/>
      </svg>`;
		case "closure":
			return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
        <path d="M2.5 15 H7.2" stroke="white" stroke-width="2.2" stroke-linecap="round" opacity="0.78"/>
        <path d="M22.8 15 H27.5" stroke="white" stroke-width="2.2" stroke-linecap="round" opacity="0.78"/>
        <rect x="6.2" y="7" width="17.6" height="16" rx="8" fill="${c}"/>
        <path d="M8.8 11.2 H21.2" stroke="white" stroke-width="1.25" stroke-linecap="round" opacity="0.34"/>
        <path d="M8.8 18.8 H21.2" stroke="white" stroke-width="1.25" stroke-linecap="round" opacity="0.34"/>
        <path d="M10.2 15 C12.2 12.7 17.8 17.3 19.8 15" stroke="white" stroke-width="1.55" fill="none" stroke-linecap="round" opacity="0.92"/>
        <circle cx="11.2" cy="15" r="1.25" fill="white" opacity="0.95"/>
        <circle cx="18.8" cy="15" r="1.25" fill="white" opacity="0.95"/>
      </svg>`;
		case "nap":
			if (options.hasInternalSplitter) {
				return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
        <rect x="3.5" y="5" width="23" height="19" rx="3.2" fill="${c}"/>
        <rect x="6.5" y="8" width="17" height="3" rx="1.2" fill="white" opacity="0.2"/>
        <path d="M7.1 14.2 Q7.1 13.1 8.1 13.6 L17.8 17.2 Q18.8 17.6 17.8 18.3 L8.1 21.9 Q7.1 22.4 7.1 21.3 Z" fill="white" opacity="0.9"/>
        <circle cx="9.7" cy="17.8" r="1" fill="${c}" opacity="0.95"/>
        <path d="M13.3 17.8 H22.7" stroke="white" stroke-width="1.35" stroke-linecap="round" opacity="0.9"/>
        <path d="M16 17.8 L22.2 14" stroke="white" stroke-width="1.35" stroke-linecap="round" opacity="0.7"/>
        <path d="M16 17.8 L22.2 21.6" stroke="white" stroke-width="1.35" stroke-linecap="round" opacity="0.7"/>
      </svg>`;
			}
			return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
        <rect x="3" y="5" width="22" height="18" rx="3" fill="${c}"/>
        <rect x="6" y="8" width="16" height="3" rx="1.2" fill="white" opacity="0.2"/>
        <rect x="6" y="13" width="4" height="4" rx="1" fill="white" opacity="0.9"/>
        <rect x="12" y="13" width="4" height="4" rx="1" fill="white" opacity="0.9"/>
        <rect x="18" y="13" width="4" height="4" rx="1" fill="white" opacity="0.9"/>
        <rect x="6" y="19" width="7" height="1.8" rx="0.9" fill="white" opacity="0.36"/>
        <rect x="15" y="19" width="7" height="1.8" rx="0.9" fill="white" opacity="0.36"/>
      </svg>`;
		case "ont":
			return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
        <rect x="3" y="8" width="16" height="11" rx="2.5" fill="${c}"/>
        <path d="M6.5 6.2 Q11 2.9 15.5 6.2" stroke="white" stroke-width="1.45" fill="none" stroke-linecap="round" opacity="0.75"/>
        <path d="M8.3 8 Q11 6.1 13.7 8" stroke="white" stroke-width="1.35" fill="none" stroke-linecap="round" opacity="0.9"/>
        <circle cx="7.2" cy="13.5" r="1.1" fill="white" opacity="0.95"/>
        <circle cx="11" cy="13.5" r="1.1" fill="white" opacity="0.95"/>
        <circle cx="14.8" cy="13.5" r="1.1" fill="white" opacity="0.95"/>
        <rect x="6" y="16.4" width="10" height="1.4" rx="0.7" fill="white" opacity="0.26"/>
      </svg>`;
	}
}

export function EquipmentSymbol({
	type,
	color,
	size,
	hasInternalSplitter = false,
}: {
	type: string;
	color: string;
	size?: number;
	hasInternalSplitter?: boolean;
}): ReactElement {
	const symbolType = normalizedType(type);

	if (symbolType === "olt") {
		return (
			<svg
				width={size ?? 30}
				height={size ?? 30}
				viewBox="0 0 38 38"
				aria-hidden="true"
			>
				<rect x="4" y="5" width="30" height="28" rx="4" fill={color} />
				<rect
					x="8"
					y="9"
					width="22"
					height="5"
					rx="1.5"
					fill="white"
					opacity="0.18"
				/>
				<rect
					x="8"
					y="17"
					width="22"
					height="5"
					rx="1.5"
					fill="white"
					opacity="0.18"
				/>
				<rect
					x="8"
					y="25"
					width="22"
					height="4"
					rx="1.5"
					fill="white"
					opacity="0.18"
				/>
				<rect
					x="10"
					y="11"
					width="12"
					height="1.6"
					rx="0.8"
					fill="white"
					opacity="0.88"
				/>
				<rect
					x="10"
					y="19"
					width="12"
					height="1.6"
					rx="0.8"
					fill="white"
					opacity="0.88"
				/>
				<rect
					x="10"
					y="26.2"
					width="12"
					height="1.6"
					rx="0.8"
					fill="white"
					opacity="0.88"
				/>
				<circle cx="27" cy="11.8" r="1.5" fill="white" opacity="0.95" />
				<circle cx="27" cy="19.8" r="1.5" fill="white" opacity="0.95" />
			</svg>
		);
	}

	if (symbolType === "splitter") {
		return (
			<svg
				width={size ?? 28}
				height={size ?? 28}
				viewBox="0 0 30 30"
				aria-hidden="true"
			>
				<path
					d="M4 5.5 Q4 4.3 5.1 4.9 L25.4 14 Q27 14.8 25.4 16 L5.1 25.1 Q4 25.7 4 24.5 Z"
					fill={color}
				/>
				<circle cx="8" cy="15" r="2.2" fill="white" opacity="0.96" />
				<path
					d="M11.2 15 H17.2"
					stroke="white"
					strokeWidth="1.7"
					strokeLinecap="round"
					opacity="0.9"
				/>
				<path
					d="M17.2 15 L24 9"
					stroke="white"
					strokeWidth="1.65"
					strokeLinecap="round"
					opacity="0.72"
				/>
				<path
					d="M17.2 15 H24.6"
					stroke="white"
					strokeWidth="1.65"
					strokeLinecap="round"
					opacity="0.86"
				/>
				<path
					d="M17.2 15 L24 21"
					stroke="white"
					strokeWidth="1.65"
					strokeLinecap="round"
					opacity="0.72"
				/>
				<circle cx="24.5" cy="9" r="1.15" fill="white" opacity="0.82" />
				<circle cx="25" cy="15" r="1.15" fill="white" opacity="0.92" />
				<circle cx="24.5" cy="21" r="1.15" fill="white" opacity="0.82" />
			</svg>
		);
	}

	if (symbolType === "closure") {
		return (
			<svg
				width={size ?? 28}
				height={size ?? 28}
				viewBox="0 0 30 30"
				aria-hidden="true"
			>
				<path
					d="M2.5 15 H7.2"
					stroke="white"
					strokeWidth="2.2"
					strokeLinecap="round"
					opacity="0.78"
				/>
				<path
					d="M22.8 15 H27.5"
					stroke="white"
					strokeWidth="2.2"
					strokeLinecap="round"
					opacity="0.78"
				/>
				<rect x="6.2" y="7" width="17.6" height="16" rx="8" fill={color} />
				<path
					d="M8.8 11.2 H21.2"
					stroke="white"
					strokeWidth="1.25"
					strokeLinecap="round"
					opacity="0.34"
				/>
				<path
					d="M8.8 18.8 H21.2"
					stroke="white"
					strokeWidth="1.25"
					strokeLinecap="round"
					opacity="0.34"
				/>
				<path
					d="M10.2 15 C12.2 12.7 17.8 17.3 19.8 15"
					stroke="white"
					strokeWidth="1.55"
					fill="none"
					strokeLinecap="round"
					opacity="0.92"
				/>
				<circle cx="11.2" cy="15" r="1.25" fill="white" opacity="0.95" />
				<circle cx="18.8" cy="15" r="1.25" fill="white" opacity="0.95" />
			</svg>
		);
	}

	if (symbolType === "nap") {
		if (hasInternalSplitter) {
			return (
				<svg
					width={size ?? 28}
					height={size ?? 28}
					viewBox="0 0 30 30"
					aria-hidden="true"
				>
					<rect x="3.5" y="5" width="23" height="19" rx="3.2" fill={color} />
					<rect
						x="6.5"
						y="8"
						width="17"
						height="3"
						rx="1.2"
						fill="white"
						opacity="0.2"
					/>
					<path
						d="M7.1 14.2 Q7.1 13.1 8.1 13.6 L17.8 17.2 Q18.8 17.6 17.8 18.3 L8.1 21.9 Q7.1 22.4 7.1 21.3 Z"
						fill="white"
						opacity="0.9"
					/>
					<circle cx="9.7" cy="17.8" r="1" fill={color} opacity="0.95" />
					<path
						d="M13.3 17.8 H22.7"
						stroke="white"
						strokeWidth="1.35"
						strokeLinecap="round"
						opacity="0.9"
					/>
					<path
						d="M16 17.8 L22.2 14"
						stroke="white"
						strokeWidth="1.35"
						strokeLinecap="round"
						opacity="0.7"
					/>
					<path
						d="M16 17.8 L22.2 21.6"
						stroke="white"
						strokeWidth="1.35"
						strokeLinecap="round"
						opacity="0.7"
					/>
				</svg>
			);
		}

		return (
			<svg
				width={size ?? 26}
				height={size ?? 26}
				viewBox="0 0 28 28"
				aria-hidden="true"
			>
				<rect x="3" y="5" width="22" height="18" rx="3" fill={color} />
				<rect
					x="6"
					y="8"
					width="16"
					height="3"
					rx="1.2"
					fill="white"
					opacity="0.2"
				/>
				<rect
					x="6"
					y="13"
					width="4"
					height="4"
					rx="1"
					fill="white"
					opacity="0.9"
				/>
				<rect
					x="12"
					y="13"
					width="4"
					height="4"
					rx="1"
					fill="white"
					opacity="0.9"
				/>
				<rect
					x="18"
					y="13"
					width="4"
					height="4"
					rx="1"
					fill="white"
					opacity="0.9"
				/>
				<rect
					x="6"
					y="19"
					width="7"
					height="1.8"
					rx="0.9"
					fill="white"
					opacity="0.36"
				/>
				<rect
					x="15"
					y="19"
					width="7"
					height="1.8"
					rx="0.9"
					fill="white"
					opacity="0.36"
				/>
			</svg>
		);
	}

	return (
		<svg
			width={size ?? 22}
			height={size ?? 22}
			viewBox="0 0 22 22"
			aria-hidden="true"
		>
			<rect x="3" y="8" width="16" height="11" rx="2.5" fill={color} />
			<path
				d="M6.5 6.2 Q11 2.9 15.5 6.2"
				stroke="white"
				strokeWidth="1.45"
				fill="none"
				strokeLinecap="round"
				opacity="0.75"
			/>
			<path
				d="M8.3 8 Q11 6.1 13.7 8"
				stroke="white"
				strokeWidth="1.35"
				fill="none"
				strokeLinecap="round"
				opacity="0.9"
			/>
			<circle cx="7.2" cy="13.5" r="1.1" fill="white" opacity="0.95" />
			<circle cx="11" cy="13.5" r="1.1" fill="white" opacity="0.95" />
			<circle cx="14.8" cy="13.5" r="1.1" fill="white" opacity="0.95" />
			<rect
				x="6"
				y="16.4"
				width="10"
				height="1.4"
				rx="0.7"
				fill="white"
				opacity="0.26"
			/>
		</svg>
	);
}
