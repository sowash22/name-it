import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ThemeWrapper from "@/components/ThemeWrapper";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Name My Pet - AI Pet Naming Assistant",
  description:
    "Find the perfect name for your beloved companion with our AI-powered pet naming assistant. Simple, fast, and delightful pet name suggestions.",
  keywords: ["pet names", "AI pet name generator", "dog names", "cat names", "pet naming"],
  icons: {
    icon: "/pets.png",
    shortcut: "/pets.png",
    apple: "/pets.png",
  },
  authors: [{ name: "Sowndarya Shanmugam", url: "https://namemypet.app" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeWrapper>
          <div className="min-h-screen flex flex-col">
            <main className="flex-grow">{children}</main>

            <footer className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-t border-slate-200/30 dark:border-slate-700/30 py-4">
              <div className="max-w-4xl mx-auto px-6 text-center">
                <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Passion project made with ❤️ and AI for pet paw-rents{" "}
                  <a
                    href="mailto:sowndarya.ashok22@gmail.com"
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
                  >
                    Drop me a note!
                  </a>
                </div>
              </div>
            </footer>
          </div>
        </ThemeWrapper>
        <SpeedInsights />
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-FPFPF023ER"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-FPFPF023ER');
          `}
        </Script>
      </body>
    </html>
  );
}