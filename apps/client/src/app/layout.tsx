import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { AppSidebar } from "@/components/layout/Sidebar";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export const metadata: Metadata = {
  title: {
    default: "EvalGate Studio — Applied AI Evaluation & Regression Testing",
    template: "%s | EvalGate Studio",
  },
  description:
    "Fast, local-first prompt evaluation, LLM-as-a-judge quality gates, and model benchmark shootout platform.",
  applicationName: "EvalGate Studio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <QueryProvider>
          <SidebarProvider defaultOpen={true}>
            <AppSidebar />
            <SidebarInset className="flex flex-col min-h-screen min-w-0">
              <Navbar />
              <main className="flex-1 p-3 sm:p-5 md:p-8 overflow-x-hidden overflow-y-auto">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
