import type { Metadata } from "next";
import "./globals.css";
import { Orbitron, Share_Tech_Mono } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
});

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Food Resilience Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${orbitron.variable} ${shareTechMono.variable}`}>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}