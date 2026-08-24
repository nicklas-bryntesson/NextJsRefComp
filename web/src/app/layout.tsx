import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import {
  APPEARANCE_COOKIE,
  resolvePreference,
  shouldProject,
} from "@/kernel/theme-preference";

/* cursor-DESIGN.md: CursorGothic is licensed; Inter is the named substitute.
   Display sits at 400 with negative tracking — the weights below cover the
   400/500/600 the doc asks for and nothing heavier. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/* Every code surface. */
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Reference Components — React / Tailwind port",
  description:
    "A press test: porting the reference-components accessibility contracts into Next.js and Tailwind under a real design system.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  /* ── The appearance projection, server-side ──────────────────────────────
   *
   * PORTING.md gives two conformant structures for restoring an explicit
   * appearance without a flash, and is unambiguous about which it prefers:
   *
   *   "Server-rendered (preferred — no client JS, no flash by construction).
   *    Read your cookie during render and emit the attribute in the markup."
   *
   * followed by: "The preference has to live somewhere the *server* can read,
   * so use a cookie, not localStorage."
   *
   * That is exactly what this does. `resolvePreference` is the kernel primitive
   * — the same function ThemeSwitch calls in the browser — so the decision is
   * specified once and cannot drift between layout and runtime, which is the
   * precise failure ADR-0021 records in the implementation it was modelled on
   * ("duplicated from Layout for runtime use").
   *
   * `shouldProject` is what keeps `system` free: it returns false, we emit no
   * attribute, and `color-scheme: light dark` follows the OS. The most common
   * case therefore needs no script, cannot flash, and costs nothing to render.
   *
   * THE COST, recorded honestly: reading a cookie in the ROOT layout makes
   * every route in the app dynamically rendered — Next.js cannot prerender a
   * tree whose html element depends on a request header. The whole kitchensink
   * moves from `○ Static` to `ƒ Dynamic`. The alternative that keeps static
   * rendering is the inline `<head>` script reading localStorage, which
   * PORTING.md explicitly ranks second and which reintroduces a script whose
   * only job is repairing the first paint. See Findings.md F-022 for the
   * measurement and the trade.
   */
  const stored = (await cookies()).get(APPEARANCE_COOKIE)?.value;
  const preference = resolvePreference(stored);
  const appearance = shouldProject(preference) ? preference : undefined;

  return (
    <html
      lang="en"
      data-appearance={appearance}
      className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
    >
      {/* The nav is FIRST, and collapsed to three tab stops so that being first
          costs almost nothing. It used to sit after `children` to keep the
          document's first heading and first focusable element untouched; see
          site-nav.tsx for why that traded the wrong thing away. */}
      <body className="min-h-dvh">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
