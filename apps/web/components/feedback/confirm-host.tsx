"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { settleConfirm, useConfirmStore } from "@/lib/feedback/confirm";

/** Renders requests created with `confirmAction()`. Mounted once at the root. */
export function ConfirmHost() {
	const request = useConfirmStore((state) => state.request);
	const [busy, setBusy] = useState(false);

	const settle = (confirmed: boolean) => {
		setBusy(false);
		settleConfirm(confirmed);
	};

	const runExtra = async () => {
		if (!request?.extraAction) return;
		setBusy(true);
		const ok = await request.extraAction.run();
		if (ok) settle(true);
		else setBusy(false);
	};

	return (
		<Dialog
			open={Boolean(request)}
			onOpenChange={(open) => {
				if (!open && !busy) settle(false);
			}}
		>
			{request && (
				<DialogContent className="w-[min(calc(100vw-2rem),28rem)] gap-0 p-5">
					<DialogTitle className="text-base">{request.title}</DialogTitle>
					{request.description ? (
						<DialogDescription className="mt-2 leading-6 text-fg-secondary">
							{request.description}
						</DialogDescription>
					) : (
						<DialogDescription className="sr-only">
							Confirma para continuar.
						</DialogDescription>
					)}
					<div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button
							type="button"
							variant="ghost"
							disabled={busy}
							onClick={() => settle(false)}
						>
							{request.cancelLabel ?? "Cancelar"}
						</Button>
						<Button
							type="button"
							variant={request.tone === "danger" ? "destructive" : "secondary"}
							disabled={busy}
							onClick={() => settle(true)}
						>
							{request.confirmLabel ?? "Confirmar"}
						</Button>
						{request.extraAction && (
							<Button
								type="button"
								variant="accent"
								disabled={busy}
								onClick={runExtra}
							>
								{busy
									? (request.extraAction.pendingLabel ?? "Procesando…")
									: request.extraAction.label}
							</Button>
						)}
					</div>
				</DialogContent>
			)}
		</Dialog>
	);
}
