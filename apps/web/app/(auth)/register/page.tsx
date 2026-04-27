"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";

export default function RegisterPage() {
	const [error, action, pending] = useActionState(signUp, null);

	return (
		<>
			<div className="mb-8 text-center">
				<h1 className="text-2xl font-semibold tracking-tight text-[#e6e6e6]">
					Crear cuenta
				</h1>
				<p className="mt-1 text-sm text-[#a4a4a4]">
					El rol asignado será <span className="font-medium">técnico</span>
				</p>
			</div>

			<form action={action} className="space-y-4">
				<div className="space-y-1.5">
					<label
						htmlFor="email"
						className="block text-sm font-medium text-[#d7d7d7]"
					>
						Email
					</label>
					<input
						id="email"
						name="email"
						type="email"
						required
						autoComplete="email"
						placeholder="usuario@empresa.ec"
						className="w-full rounded-md border border-[rgba(164,164,164,0.18)] bg-[#282929] px-3 py-2 text-sm text-[#e6e6e6] placeholder-[#777879] focus:border-[#a4a4a4] focus:outline-none focus:ring-1 focus:ring-[#a4a4a4]"
					/>
				</div>

				<div className="space-y-1.5">
					<label
						htmlFor="password"
						className="block text-sm font-medium text-[#d7d7d7]"
					>
						Contraseña
					</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						autoComplete="new-password"
						minLength={8}
						className="w-full rounded-md border border-[rgba(164,164,164,0.18)] bg-[#282929] px-3 py-2 text-sm text-[#e6e6e6] placeholder-[#777879] focus:border-[#a4a4a4] focus:outline-none focus:ring-1 focus:ring-[#a4a4a4]"
					/>
				</div>

				{error && (
					<p className="rounded-md border border-[#fb4d6d]/30 bg-[#fb4d6d]/10 px-3 py-2 text-sm text-[#ff9aaa]">
						{error}
					</p>
				)}

				<button
					type="submit"
					disabled={pending}
					className="w-full rounded-md bg-[#e6e6e6] px-4 py-2 text-sm font-medium text-[#242424] transition-colors hover:bg-[#d7d7d7] focus:outline-none focus:ring-2 focus:ring-[#a4a4a4] focus:ring-offset-2 focus:ring-offset-[#222324] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{pending ? "Creando cuenta…" : "Crear cuenta"}
				</button>
			</form>

			<p className="mt-6 text-center text-sm text-[#a4a4a4]">
				¿Ya tienes cuenta?{" "}
				<Link
					href="/login"
					className="font-medium text-[#e6e6e6] hover:underline"
				>
					Inicia sesión
				</Link>
			</p>
		</>
	);
}
