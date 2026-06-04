import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Akademia Ora - Sistemi i Menaxhimit",
  description: "Sistemi i menaxhimit të shkollës private Akademia Ora",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sq" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
