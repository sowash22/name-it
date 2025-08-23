import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import Script from "next/script"; // ✅ import Script
import { SpeedInsights } from "@vercel/speed-insights/next";

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
    icon: "/pets.png", // your PNG favicon
    shortcut: "/pets.png", // optional
  },
  authors: [{ name: "Sowndarya Shanmugam", url: "https://namemypet.app" }],
  openGraph: {
    title: "Name My Pet - AI Pet Naming Assistant",
    description: "Find the perfect name for your beloved companion with AI!",
    url: "https://namemypet.app",
    siteName: "Name My Pet",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AI Pet Naming Assistant",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Name My Pet - AI Pet Naming Assistant",
    description: "Find the perfect name for your beloved companion with AI!",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* ✅ Google Analytics */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-FPFPF023ER"
        />
        <Script id="google-analytics">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-FPFPF023ER');
          `}
        </Script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme={process.env.NEXT_PUBLIC_DEFAULT_THEME || 'dark'} enableSystem>
          <div className="min-h-screen flex flex-col">
            <main className="flex-grow">
              {children}
            </main>
            
            {/* Minimal Footer */}
            <footer className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-t border-slate-200/30 dark:border-slate-700/30 py-4">
              <div className="max-w-4xl mx-auto px-6 text-center">
                {/* <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-2xl">🐾</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Name My Pet
                  </span>
                </div> */}
                
                {/* <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
                  A passion project helping you discover the perfect name for your beloved furry friend with the help of AI
                </p> */}
                
                <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Passion project made with ❤️ and AI for pet lovers everywhere.{' '}
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
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
