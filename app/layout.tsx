import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/Providers";
import { ThemeProvider } from "@/lib/ThemeContext";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { JournalShell } from "@/components/journal/JournalShell";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gutter",
  description: "AI-native bullet journal for sequential logging and migration",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Gutter",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff6ec7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-foreground antialiased">
        <Providers>
          <ThemeProvider>
            <ServiceWorkerRegistration />
            <Toaster position="top-right" richColors theme="dark" />
            <JournalShell>{children}</JournalShell>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
