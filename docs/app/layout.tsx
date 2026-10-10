import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";
import { SITE, source } from "@/lib/source";
import corePackage from "../../packages/core/package.json";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  weight: "variable",
  subsets: ["latin"],
  display: "swap",
});

// Ioskeley Mono (OFL-1.1, github.com/ahatem/IoskeleyMono). Only the ligature
// build ships web fonts, so globals.css turns ligatures off for mono text.
const ioskeleyMono = localFont({
  variable: "--font-ioskeley-mono",
  src: [
    { path: "./fonts/IoskeleyMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IoskeleyMono-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IoskeleyMono-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: SITE ? new URL(SITE) : undefined,
  title: { default: "Intentface Launch", template: "%s · Intentface Launch" },
  description: "Product launch videos written as code: React scenes rendered frame by frame, made with an agent.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt" />
      </head>
      <body className={`${inter.variable} ${ioskeleyMono.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SiteShell tree={source.pageTree} version={corePackage.version}>
            {children}
          </SiteShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
