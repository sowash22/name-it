"use client";

import { ThemeProvider } from "next-themes";
import { useEffect } from "react";

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      enableSystem={false}
      storageKey="session-theme"
      storageType="sessionStorage"
      defaultTheme="light" // placeholder to avoid SSR mismatch
    >
      <TimeBasedThemeSetter />
      {children}
    </ThemeProvider>
  );
}

// ⏰ Sets initial theme client-side based on time if user hasn’t chosen
function TimeBasedThemeSetter() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { setTheme } = require("next-themes").useTheme();

  useEffect(() => {
    const saved = sessionStorage.getItem("session-theme");
    if (saved) return;

    const hour = new Date().getHours();
    const theme = hour >= 6 && hour < 18 ? "light" : "dark";
    setTheme(theme);
    sessionStorage.setItem("session-theme", theme);
  }, [setTheme]);

  return null;
}
