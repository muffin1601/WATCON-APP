import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Watcon Enterprise", template: "%s · Watcon Enterprise" },
  description: "Project and task management for Watcon sites and teams.",
  robots: { index: false, follow: false },
};

/** Static, constant script (no user input) — removes extension-injected attributes for ~5 s after load. */
const STRIP_EXTENSION_ATTRIBUTES = `(function(){var A=["bis_skin_checked","bis_register"];function c(n){A.forEach(function(a){if(n.removeAttribute&&n.hasAttribute&&n.hasAttribute(a))n.removeAttribute(a)})}
var o=new MutationObserver(function(ms){ms.forEach(function(m){c(m.target)})});o.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:A});
addEventListener("load",function(){setTimeout(function(){o.disconnect()},5000)})})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      {process.env.NODE_ENV === "development" && (
        <head>
          {/* Dev only: some browser extensions inject `bis_skin_checked` into every <div> before React
              hydrates, producing noisy hydration warnings. Strip it until the page has settled. */}
          <script dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRIBUTES }} />
        </head>
      )}
      <body className="min-h-full bg-background font-sans text-foreground" suppressHydrationWarning>
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
