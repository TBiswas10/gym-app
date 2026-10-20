import type { Metadata, Viewport } from "next";
import { ErrorReporter } from "@/components/ErrorReporter";
import { KeyboardFit } from "@/components/KeyboardFit";
import { ServiceWorker } from "@/components/ServiceWorker";
import { SplashScreen } from "@/components/SplashScreen";
import { UpdateWatcher } from "@/components/UpdateWatcher";
import { SPLASH_SIZES, splashKey, splashMedia } from "@/lib/splash";
import { BG } from "@/lib/tokens";
import "./globals.css";
import "@/styles/fonts.css";
import "@/styles/tokens.css";
import "@/styles/components.css";
import "@/styles/screens.css";
import "@/styles/app.css";

export const metadata: Metadata = {
  title: "Workout Tracker",
  description: "Short sessions. Simple tracking. 45 to 50 minutes, start to finish.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Workout",
    startupImage: SPLASH_SIZES.map((s) => ({ url: `/splash/${splashKey(s)}.png`, media: splashMedia(s) })),
  },
  icons: { apple: "/icons/180", icon: "/icons/192" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: BG,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" style={{ background: BG }}>
      <body style={{ background: BG }}>
        <ServiceWorker />
        <KeyboardFit />
        <UpdateWatcher />
        <ErrorReporter />
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
