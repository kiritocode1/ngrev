"use client";
import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon as Monitor, Moon02Icon as Moon, Sun02Icon as Sun } from "@hugeicons/core-free-icons";
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
            <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-full border border-border aspect-square w-fit">
                {themeOptions.map(({ value, icon: Icon, label }) => (
                    <div
                        key={value}
                        className="flex items-center justify-center p-2 rounded-full text-muted-foreground"
                    >
                        <HugeiconsIcon icon={Icon} fill="currentColor" className="w-4 h-4" />
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
            <div className="flex bg-muted p-1 rounded-full border border-border">
                {themeOptions.map(({ value, icon: Icon, label }) => (
                    <Label
                        key={value}
                        htmlFor={value}
                        className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-full cursor-pointer transition-colors",
                            theme === value
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <RadioGroupItem value={value} id={value} className="sr-only hidden" />
                        <HugeiconsIcon icon={Icon} fill="currentColor" className="w-6 h-6" />
                        <span className="sr-only">{label}</span>
                    </Label>
                ))}
            </div>
        </RadioGroup>
    );
}