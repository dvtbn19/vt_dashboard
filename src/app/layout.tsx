import type { Metadata, Viewport } from "next";
// Self-hosted fonts (all subsets incl. Vietnamese, loaded per unicode-range)
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/newsreader/400-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "William Doan — data analyst, data & AI engineer",
  description:
    "Van Thang (William) Doan: business background, data science master's (UTS), building data pipelines, models and AI agents in Sydney.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#10151f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
