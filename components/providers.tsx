"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FinanceProvider } from "@/components/finance/finance-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <FinanceProvider>
          {children}
          <Toaster />
        </FinanceProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
