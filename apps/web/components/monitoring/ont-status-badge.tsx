import { Badge } from "@/components/ui/badge";
import { ONT_STATUS_LABELS, type OntStatus } from "@/lib/types/gpon";

interface OntStatusBadgeProps {
	status: OntStatus;
}

const STATUS_VARIANT: Record<
	OntStatus,
	"default" | "secondary" | "destructive" | "outline"
> = {
	online: "default",
	offline: "destructive",
	los: "destructive",
	lof: "destructive",
	unknown: "outline",
};

const STATUS_DOT: Record<OntStatus, string> = {
	online: "bg-emerald-500",
	offline: "bg-red-500",
	los: "bg-red-500",
	lof: "bg-amber-500",
	unknown: "bg-muted-foreground",
};

export function OntStatusBadge({ status }: OntStatusBadgeProps) {
	return (
		<Badge variant={STATUS_VARIANT[status]} className="gap-1.5">
			<span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
			{ONT_STATUS_LABELS[status]}
		</Badge>
	);
}
