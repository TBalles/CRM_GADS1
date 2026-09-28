import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/lib/brand";
import { ToastProvider } from "@/components/ui/Toast";
import { TooltipHost } from "@/components/ui/Tooltip";

// Inter is the kit's typeface (DESIGN.md §0.3), self-hosted by next/font so
// there's no flash of a fallback face. It still dresses the landing, which
// keeps the look it shipped with (see .landing-root in globals.css).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// The CRM's typeface. Inter is the default of half the web: correct, and for
// that exact reason it makes a product look like every other one. Jakarta is
// still a UI grotesque -- legible at 13px inside a dense table -- but its
// letterforms carry the product's own voice.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

// Numbers only -- amounts, counts, the headline figure. A CRM is a measuring
// instrument, and a monospaced numeral set says so: digits sit on a fixed
// grid, so a column of money reads as a scale instead of as prose. The skill's
// dashboard pairing suggested Fira Code; JetBrains Mono is the same idea with
// cleaner numerals and no programming ligatures we would never use.
const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
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
      className={`${inter.variable} ${jakarta.variable} ${mono.variable} h-full antialiased`}
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
