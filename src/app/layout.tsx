import type { Metadata, Viewport } from "next";
import { getTheme } from "@/lib/theme";
// Self-hosted fonts (all subsets incl. Vietnamese, loaded per unicode-range)
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "William Doan — data analyst, data & AI engineer",
  description:
    "Van Thang (William) Doan: business background, data science master's (UTS), building data pipelines, models and AI agents in Sydney.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await getTheme();
  return (
    <html lang="en" data-theme={theme} className="h-full antialiased">
      <head>
        <meta name="theme-color" content={theme === "light" ? "#f3f5f9" : "#0c111d"} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
