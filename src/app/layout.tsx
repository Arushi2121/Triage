import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Triage",
  description: "Slack agent backend for GitHub triage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
