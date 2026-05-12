import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { QueryProvider } from "@/lib/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
	title: "GPON Network Management",
	description: "Sistema de gestión de red GPON — Azuay, Ecuador",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: "#1b1c1d",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="es"
			className={`h-full antialiased ${GeistSans.variable} ${GeistMono.variable}`}
		>
			<body className="h-full" suppressHydrationWarning>
				<QueryProvider>{children}</QueryProvider>
			</body>
		</html>
	);
}
