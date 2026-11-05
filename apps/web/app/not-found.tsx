import { RouteNotFound } from "@/components/feedback/route-states";

export default function NotFound() {
	return (
		<div className="flex min-h-dvh items-center justify-center bg-background">
			<RouteNotFound />
		</div>
	);
}
