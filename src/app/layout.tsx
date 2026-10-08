import type { Metadata, Viewport } from "next";
import { BG } from "@/lib/tokens";
import "./globals.css";
import "@/styles/fonts.css";
import "@/styles/tokens.css";
import "@/styles/components.css";
import "@/styles/app.css";

export const metadata: Metadata = {
  title: "Workout Tracker",
  description: "Short sessions. Simple tracking. 45 to 50 minutes, start to finish.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Workout" },
  icons: { apple: "/icons/180", icon: "/icons/192" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: BG,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
