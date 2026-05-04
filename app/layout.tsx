import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Office — your team of agents at work",
  description: "Watch a team of AI agents plan, prompt, build, and review tasks together.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
