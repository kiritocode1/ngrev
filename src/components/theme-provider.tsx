"use client";
import { ThemeProvider as BetterThemeProvider } from "better-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <BetterThemeProvider attribute={"class"} defaultTheme="dark" enableSystem>
      {children}
    </BetterThemeProvider>
  );
}
