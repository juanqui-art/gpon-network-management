import type { Metadata } from "next";
import { QueryProvider } from "@/lib/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
	title: "GPON Network Management",
	description: "Sistema de gestión de red GPON — Azuay, Ecuador",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="es" className="h-full antialiased">
			<body className="h-full" suppressHydrationWarning>
				<QueryProvider>{children}</QueryProvider>
			</body>
		</html>
	);
}
