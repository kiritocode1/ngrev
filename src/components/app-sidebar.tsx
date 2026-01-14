"use client";

import { Activity02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarRail,
    SidebarSeparator as SidebarSep,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTracker, type DetectionMode } from "@/context/tracker-context";
import { type BoundingBoxStyle } from "@/lib/tracking/types";
import { cn } from "@/lib/utils";


const BOX_STYLES: { value: BoundingBoxStyle; label: string }[] = [
    { value: "basic", label: "BASIC" },
    { value: "frame", label: "FRAME" },
    { value: "corner-l", label: "L-FRAME" },
    { value: "dash", label: "DASH" },
    { value: "grid", label: "GRID" },
    { value: "scope", label: "SCOPE" },
    { value: "none", label: "NONE" },
];

const PRESET_COLORS = [
    "#ffffff", // White
    "#ef4444", // Red
    "#f97316", // Orange
    "#facc15", // Yellow
    "#22c55e", // Green
    "#06b6d4", // Cyan
    "#3b82f6", // Blue
    "#a855f7", // Purple
    "#ec4899", // Pink
    "#000000", // Black
];

const FONT_SIZES = [10, 12, 14, 16, 18, 20];



export function AppSidebar() {
    const {
        config,
        setConfig,
        detectionMode,
        setDetectionMode,
        detectionThreshold,
        setDetectionThreshold,
        motionThreshold,
        setMotionThreshold,
        minBlobSize,
        setMinBlobSize,
        rendererConfig,
        setRendererConfig,
        stats,
    } = useTracker();

    return (
        <Sidebar collapsible="icon" className="border-r border-border">
            <SidebarHeader className="p-4 border-b border-border">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-8 h-8 bg-foreground text-background flex items-center justify-center font-bold text-sm">
                        N
                    </div>
                    <div className="group-data-[collapsible=icon]:hidden">
                        <span className="font-bold tracking-tight">NGREV</span>
                        <span className="text-mono text-xs text-muted-foreground ml-2">v1.0</span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent className="p-0">

                <SidebarGroup className="group-data-[collapsible=icon]:hidden border-b border-border">
                    <SidebarGroupLabel className="text-mono text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3">
                        01. Detection Config
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="space-y-4 px-4 pb-4">

                        {/* Detection Mode */}
                        <div className="space-y-2">
                            <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Mode</Label>
                            <ToggleGroup
                                value={[detectionMode]}
                                onValueChange={(val: string[]) => {
                                    if (Array.isArray(val)) {
                                        if (val.length > 1) {
                                            const newMode = val.find((v: string) => v !== detectionMode);
                                            if (newMode) setDetectionMode(newMode as DetectionMode);
                                        } else if (val.length === 1) {
                                            setDetectionMode(val[0] as DetectionMode);
                                        }
                                    }
                                }}
                                className="justify-start w-full bg-accent p-0.5"
                            >
                                <ToggleGroupItem value="objects" aria-label="Objects" className="flex-1 text-mono text-[10px] uppercase data-[state=on]:bg-foreground data-[state=on]:text-background h-7">
                                    Objects
                                </ToggleGroupItem>
                                <ToggleGroupItem value="motion" aria-label="Motion" className="flex-1 text-mono text-[10px] uppercase data-[state=on]:bg-foreground data-[state=on]:text-background h-7">
                                    Motion
                                </ToggleGroupItem>
                                <ToggleGroupItem value="both" aria-label="Both" className="flex-1 text-mono text-[10px] uppercase data-[state=on]:bg-foreground data-[state=on]:text-background h-7">
                                    Both
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>

                        {/* Object Threshold */}
                        {(detectionMode === "objects" || detectionMode === "both") && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Threshold</Label>
                                    <span className="text-mono text-[10px] text-foreground">
                                        {detectionThreshold.toFixed(2)}
                                    </span>
                                </div>
                                <Slider
                                    value={[detectionThreshold]}
                                    min={0.1}
                                    max={0.9}
                                    step={0.05}
                                    onValueChange={(vals) => setDetectionThreshold(Array.isArray(vals) ? vals[0] : vals)}
                                    className="py-1"
                                />
                            </div>
                        )}

                        {/* Motion Sensitivity */}
                        {(detectionMode === "motion" || detectionMode === "both") && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Sensitivity</Label>
                                    <span className="text-mono text-[10px] text-foreground">
                                        {motionThreshold}
                                    </span>
                                </div>
                                <Slider
                                    value={[motionThreshold]}
                                    min={10}
                                    max={80}
                                    step={5}
                                    onValueChange={(vals) => setMotionThreshold(Array.isArray(vals) ? vals[0] : vals)}
                                    className="py-1"
                                />
                            </div>
                        )}

                        {/* Min Blob Size */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Min Size (px²)</Label>
                                <span className="text-mono text-[10px] text-foreground">
                                    {minBlobSize}
                                </span>
                            </div>
                            <Slider
                                value={[minBlobSize]}
                                min={100}
                                max={2000}
                                step={100}
                                onValueChange={(vals) => setMinBlobSize(Array.isArray(vals) ? vals[0] : vals)}
                                className="py-1"
                            />
                        </div>

                        {/* Line Distance */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Line Distance</Label>
                                <span className="text-mono text-[10px] text-foreground">
                                    {config.maxLineDistance}px
                                </span>
                            </div>
                            <Slider
                                value={[config.maxLineDistance]}
                                min={50}
                                max={500}
                                step={25}
                                onValueChange={(vals) =>
                                    setConfig((c) => ({ ...c, maxLineDistance: Array.isArray(vals) ? vals[0] : vals }))
                                }
                                className="py-1"
                            />
                        </div>

                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup className="group-data-[collapsible=icon]:hidden border-b border-border">
                    <SidebarGroupLabel className="text-mono text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3">
                        02. Visual Settings
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="space-y-4 px-4 pb-4">

                        {/* Visualization Toggles */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Region Style</Label>
                                <div className="grid grid-cols-3 gap-1">
                                    {BOX_STYLES.map((style) => (
                                        <Button
                                            key={style.value}
                                            variant={rendererConfig.boxStyle === style.value ? "default" : "outline"}
                                            size="sm"
                                            className={cn(
                                                "h-7 text-mono text-[9px] px-1",
                                                rendererConfig.boxStyle === style.value
                                                    ? "bg-foreground text-background hover:bg-foreground/90"
                                                    : "bg-transparent hover:bg-accent border-border"
                                            )}
                                            onClick={() => setRendererConfig(prev => ({ ...prev, boxStyle: style.value }))}
                                        >
                                            {style.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <Separator className="bg-border" />

                            <div className="space-y-2">
                                {/* Font Size & Position */}
                                <div className="space-y-2">
                                    <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Text Position</Label>

                                    {/* Position Toggle */}
                                    <ToggleGroup
                                        value={rendererConfig.textPosition ? [rendererConfig.textPosition] : ["top"]}
                                        onValueChange={(val) => {
                                            const newVal = Array.isArray(val) ? val[val.length - 1] : val;
                                            if (newVal) setRendererConfig(prev => ({ ...prev, textPosition: newVal as "top" | "center" | "bottom" }));
                                        }}
                                        className="justify-start w-full bg-accent p-0.5"
                                    >
                                        <ToggleGroupItem value="top" className="flex-1 text-mono text-[9px] h-6 data-[state=on]:bg-foreground data-[state=on]:text-background">TOP</ToggleGroupItem>
                                        <ToggleGroupItem value="center" className="flex-1 text-mono text-[9px] h-6 data-[state=on]:bg-foreground data-[state=on]:text-background">CENTER</ToggleGroupItem>
                                        <ToggleGroupItem value="bottom" className="flex-1 text-mono text-[9px] h-6 data-[state=on]:bg-foreground data-[state=on]:text-background">BOTTOM</ToggleGroupItem>
                                    </ToggleGroup>

                                    {/* Font Size Buttons */}
                                    <div className="flex gap-1 mt-2">
                                        {FONT_SIZES.map(size => (
                                            <Button
                                                key={size}
                                                variant={rendererConfig.fontSize === size ? "default" : "outline"}
                                                size="sm"
                                                className={cn(
                                                    "flex-1 h-6 text-mono text-[9px] px-0",
                                                    rendererConfig.fontSize === size
                                                        ? "bg-foreground text-background"
                                                        : "bg-transparent border-border"
                                                )}
                                                onClick={() => setRendererConfig(prev => ({ ...prev, fontSize: size }))}
                                            >
                                                {size}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <Separator className="bg-border" />

                                {/* Color Presets */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Color</Label>
                                        <div className="flex items-center gap-2">
                                            <div className="relative w-4 h-4 overflow-hidden border border-border cursor-pointer bg-gradient-to-br from-red-500 via-green-500 to-blue-500">
                                                <input
                                                    type="color"
                                                    value={rendererConfig.boxColor}
                                                    onChange={(e) => setRendererConfig(prev => ({ ...prev, boxColor: e.target.value }))}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-5 gap-1">
                                        {PRESET_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                className={cn(
                                                    "w-full aspect-square border transition-all hover:scale-105 focus:outline-none",
                                                    rendererConfig.boxColor === color
                                                        ? "border-foreground scale-105"
                                                        : "border-border/50"
                                                )}
                                                style={{ backgroundColor: color }}
                                                onClick={() => setRendererConfig(prev => ({ ...prev, boxColor: color }))}
                                            >
                                                {rendererConfig.boxColor === color && (
                                                    <span className="flex inset-0 items-center justify-center drop-shadow-md">
                                                        <HugeiconsIcon icon={Activity02Icon} className="w-3 h-3 mx-auto" style={{ color: color === "#ffffff" || color === "#facc15" ? "#000" : "#fff" }} />
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <Separator className="bg-border" />

                                {/* Fixed Size Slider */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Fixed Size</Label>
                                        <span className="text-mono text-[10px] text-foreground">
                                            {(rendererConfig.fixedBoxSize || 0) === 0 ? "AUTO" : `${rendererConfig.fixedBoxSize}px`}
                                        </span>
                                    </div>
                                    <Slider
                                        value={[rendererConfig.fixedBoxSize || 0]}
                                        min={0}
                                        max={200}
                                        step={5}
                                        onValueChange={(val) => {
                                            const newValue = Array.isArray(val) ? val[0] : val;
                                            setRendererConfig(prev => ({ ...prev, fixedBoxSize: newValue }));
                                        }}
                                        className="py-1"
                                    />
                                </div>

                                <Separator className="bg-border" />

                                {/* Stroke Widths */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-mono text-[9px] uppercase text-muted-foreground">Box</Label>
                                            <span className="text-mono text-[9px] text-foreground">{rendererConfig.boxWidth}px</span>
                                        </div>
                                        <Slider
                                            value={[rendererConfig.boxWidth]}
                                            min={0}
                                            max={10}
                                            step={1}
                                            onValueChange={(val) => {
                                                const newVal = Array.isArray(val) ? val[0] : val;
                                                setRendererConfig(prev => ({ ...prev, boxWidth: newVal }));
                                            }}
                                            className="py-1"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-mono text-[9px] uppercase text-muted-foreground">Line</Label>
                                            <span className="text-mono text-[9px] text-foreground">{rendererConfig.lineWidth}px</span>
                                        </div>
                                        <Slider
                                            value={[rendererConfig.lineWidth]}
                                            min={0}
                                            max={10}
                                            step={1}
                                            onValueChange={(val) => {
                                                const newVal = Array.isArray(val) ? val[0] : val;
                                                setRendererConfig(prev => ({ ...prev, lineWidth: newVal }));
                                            }}
                                            className="py-1"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator className="bg-border" />

                            <div className="flex items-center justify-between">
                                <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Show Lines</Label>
                                <Switch
                                    checked={rendererConfig.showLines}
                                    onCheckedChange={(c: boolean) => setRendererConfig(prev => ({ ...prev, showLines: c }))}
                                    size="sm"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Labels</Label>
                                <Switch
                                    checked={rendererConfig.showLabels}
                                    onCheckedChange={(c: boolean) => setRendererConfig(prev => ({ ...prev, showLabels: c }))}
                                    size="sm"
                                />
                            </div>
                        </div>

                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel className="text-mono text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3">
                        03. Live Stats
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="px-4 pb-4">
                        {/* Stats Display */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-accent border border-border p-3 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-mono text-foreground">{stats.objectCount}</span>
                                <span className="text-mono text-[9px] uppercase text-muted-foreground">Objects</span>
                            </div>
                            <div className="bg-accent border border-border p-3 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-mono text-foreground">{stats.fps}</span>
                                <span className="text-mono text-[9px] uppercase text-muted-foreground">FPS</span>
                            </div>
                        </div>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarRail />
        </Sidebar>
    );
}
