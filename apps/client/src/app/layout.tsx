import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { QueryProvider } from "@/components/providers/QueryProvider";

export const metadata: Metadata = {
  title: "EvalGate Studio — Applied AI Evaluation & Regression Testing",
  description:
    "Fast, local-first prompt evaluation, LLM-as-a-judge quality gates, and model benchmark shootout platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased">
        <QueryProvider>
          <Navbar />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-8">{children}</main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
