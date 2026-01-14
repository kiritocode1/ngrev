"use client";
import {
  ComputerIcon as Monitor,
  Moon02Icon as Moon,
  Sun02Icon as Sun,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTheme } from "better-themes";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "light", icon: Sun, label: "Light" },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="flex bg-accent border border-border">
        {themeOptions.map(({ value, icon: Icon, label }) => (
          <div
            key={value}
            className="flex items-center justify-center p-2 text-muted-foreground"
          >
            <HugeiconsIcon
              icon={Icon}
              fill="currentColor"
              className="w-3 h-3"
            />
            <span className="sr-only">{label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <RadioGroup
      value={theme}
      onValueChange={(value) => setTheme(value as string)}
      className="flex items-center"
    >
      <div className="flex bg-accent border border-border">
        {themeOptions.map(({ value, icon: Icon, label }) => (
          <Label
            key={value}
            htmlFor={value}
            className={cn(
              "flex items-center justify-center w-8 h-8 cursor-pointer transition-colors",
              theme === value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            <RadioGroupItem
              value={value}
              id={value}
              className="sr-only hidden"
            />
            <HugeiconsIcon
              icon={Icon}
              fill="currentColor"
              className="w-3 h-3"
            />
            <span className="sr-only">{label}</span>
          </Label>
        ))}
      </div>
    </RadioGroup>
  );
}
