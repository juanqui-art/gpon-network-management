import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditLogInput {
	actorUserId: string;
	actorEmail: string | null;
	action: string;
	targetType: string;
	targetId?: string | null;
	targetLabel?: string | null;
	metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
	const admin = createAdminClient();
	const { error } = await admin.from("audit_logs").insert({
		actor_user_id: input.actorUserId,
		actor_email: input.actorEmail,
		action: input.action,
		target_type: input.targetType,
		target_id: input.targetId ?? null,
		target_label: input.targetLabel ?? null,
		metadata: input.metadata ?? {},
	});

	if (error) {
		console.error("Failed to write audit log", error);
	}
}
