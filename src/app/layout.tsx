import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { TooltipHost } from "@/components/ui/Tooltip";

// Inter is the kit's typeface (DESIGN.md §0.3), self-hosted by next/font so
// there's no flash of a fallback face.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CRM GADS1",
  description: "CRM para proveedores y distribuidores de equipamiento deportivo",
};

// Applies the stored theme before the first paint, so dark mode never flashes
// white on load.
const themeInitScript = `
  try {
    var stored = localStorage.getItem("theme");
    var isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (isDark) document.documentElement.classList.add("dark");
  } catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground selection:bg-brand/20">
        <ToastProvider>
          {children}
          <TooltipHost />
        </ToastProvider>
      </body>
    </html>
  );
}
