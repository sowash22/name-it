"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";

function TimeBasedThemeSetter({ onThemeReady }: { onThemeReady: (theme: string) => void }) {
  useEffect(() => {
    const storedTheme = sessionStorage.getItem("theme");

    let theme: string;
    if (storedTheme) {
      theme = storedTheme;
    } else {
      const hour = new Date().getHours();
      theme = hour >= 18 || hour < 6 ? "dark" : "light";
      sessionStorage.setItem("theme", theme);
    }

    onThemeReady(theme);
  }, [onThemeReady]);

  return null;
}

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<string | undefined>(undefined);

  if (!theme) {
    // Avoid rendering children until theme is known
    return <TimeBasedThemeSetter onThemeReady={setTheme} />;
  }

  return (
    <ThemeProvider
      attribute="class"
      enableSystem={false}
      defaultTheme={theme} // force initial theme
    >
      {children}
    </ThemeProvider>
  );
}
