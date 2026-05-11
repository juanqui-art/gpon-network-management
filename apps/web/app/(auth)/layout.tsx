import { Card } from "@/components/ui/card";

export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4 text-foreground">
			<div className="absolute inset-0 bg-[linear-gradient(rgba(164,164,164,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(164,164,164,0.045)_1px,transparent_1px)] bg-[size:48px_48px]" />
			<div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(56,189,248,0.08),transparent_34%,rgba(52,211,153,0.07)_68%,transparent)]" />
			<Card className="relative w-full max-w-[430px] rounded-lg border-border/80 bg-card/92 px-6 py-7 shadow-2xl shadow-black/35 backdrop-blur-xl sm:px-8">
				{children}
			</Card>
		</div>
	);
}
