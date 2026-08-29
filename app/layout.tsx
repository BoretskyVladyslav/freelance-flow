import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppProviders } from "@/components/providers";
import { cn } from "@/lib/utils";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Freelance Flow",
  description: "Freelance revenue, tax, and multi-currency payout tracker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geistSans.variable)}>
      <body className={cn("min-h-screen antialiased", geistMono.variable)}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
