"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
	const [message, action, pending] = useActionState(requestPasswordReset, null);
	const isSuccess = message?.startsWith("Si el email");

	return (
		<>
			<div className="mb-8 text-center">
				<h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
					Recuperar contraseña
				</h1>
				<p className="mt-1 text-sm text-[#a4a4a4]">
					Te enviaremos un enlace de recuperación
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

				{message && (
					<p
						className={`rounded-md border px-3 py-2 text-sm ${
							isSuccess
								? "border-[#4ade80]/30 bg-[#4ade80]/10 text-[#86efac]"
								: "border-[#fb4d6d]/30 bg-[#fb4d6d]/10 text-[#ff9aaa]"
						}`}
					>
						{message}
					</p>
				)}

				<button
					type="submit"
					disabled={pending || isSuccess}
					className="w-full rounded-md bg-[#e6e6e6] px-4 py-2 text-sm font-medium text-[#242424] transition-colors hover:bg-[#d7d7d7] focus:outline-none focus:ring-2 focus:ring-[#a4a4a4] focus:ring-offset-2 focus:ring-offset-[#222324] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{pending ? "Enviando…" : "Enviar enlace"}
				</button>
			</form>

			<p className="mt-6 text-center text-sm text-[#a4a4a4]">
				<Link
					href="/login"
					className="font-medium text-[#e6e6e6] hover:underline"
				>
					Volver al inicio de sesión
				</Link>
			</p>
		</>
	);
}
