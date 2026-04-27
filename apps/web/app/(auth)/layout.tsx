export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex min-h-screen items-center justify-center bg-[#1b1c1d] p-4">
			<div className="w-full max-w-sm rounded-xl border border-[rgba(164,164,164,0.18)] bg-[#222324] p-8 shadow-2xl">
				{children}
			</div>
		</div>
	);
}
