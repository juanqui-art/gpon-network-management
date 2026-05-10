import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import { QueryProvider } from "@/lib/providers/query-provider";
import "./globals.css";

const roboto = Roboto({
	subsets: ["latin"],
	weight: ["300", "400", "500", "700"],
	variable: "--font-sans",
	display: "swap",
});

const robotoMono = Roboto_Mono({
	subsets: ["latin"],
	weight: ["400", "500"],
	variable: "--font-mono",
	display: "swap",
});

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
		<html lang="es" className={`h-full antialiased ${roboto.variable} ${robotoMono.variable}`}>
			<body className="h-full" suppressHydrationWarning>
				<QueryProvider>{children}</QueryProvider>
			</body>
		</html>
	);
}
