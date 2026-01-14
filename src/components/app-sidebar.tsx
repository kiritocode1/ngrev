"use client";

import { Activity02Icon, Calendar02Icon, Home02Icon, Settings02Icon, Video02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
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
    { value: "basic", label: "Basic" },
    { value: "frame", label: "Frame" },
    { value: "corner-l", label: "L-Frame" },
    { value: "dash", label: "Dash" },
    { value: "grid", label: "Grid" },
    { value: "scope", label: "Scope" },
    { value: "none", label: "None" },
];



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
        <Sidebar collapsible="icon">
            <SidebarHeader className="p-4 border-b border-sidebar-border">
                <div className="flex items-center gap-2 font-bold text-xl px-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                        N
                    </div>
                    <span className="group-data-[collapsible=icon]:hidden">ngrev</span>
                </div>
            </SidebarHeader>
            <SidebarContent>

                <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel>Tracker Configuration</SidebarGroupLabel>
                    <SidebarGroupContent className="space-y-6 px-2 py-2">

                        {/* Detection Mode */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">Mode</Label>
                            <ToggleGroup
                                value={[detectionMode]}
                                onValueChange={(val: any) => {
                                    if (Array.isArray(val)) {
                                        if (val.length > 1) {
                                            const newMode = val.find((v: string) => v !== detectionMode);
                                            if (newMode) setDetectionMode(newMode as DetectionMode);
                                        } else if (val.length === 1) {
                                            setDetectionMode(val[0] as DetectionMode);
                                        }
                                    }
                                }}
                                className="justify-start w-full bg-muted/50 p-1 rounded-lg"
                            >
                                <ToggleGroupItem value="objects" aria-label="Objects" className="flex-1 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
                                    Objects
                                </ToggleGroupItem>
                                <ToggleGroupItem value="motion" aria-label="Motion" className="flex-1 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
                                    Motion
                                </ToggleGroupItem>
                                <ToggleGroupItem value="both" aria-label="Both" className="flex-1 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
                                    Both
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>

                        {/* Object Threshold */}
                        {(detectionMode === "objects" || detectionMode === "both") && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs">Object Threshold</Label>
                                    <span className="text-xs text-muted-foreground font-mono">
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
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs">Motion Sensitivity</Label>
                                    <span className="text-xs text-muted-foreground font-mono">
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
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs">Min Size (px²)</Label>
                                <span className="text-xs text-muted-foreground font-mono">
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
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs">Line Distance</Label>
                                <span className="text-xs text-muted-foreground font-mono">
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

                <SidebarSep />

                <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel>Visuals & Stats</SidebarGroupLabel>
                    <SidebarGroupContent className="space-y-6 px-2 py-2">

                        {/* Visualization Toggles */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase">Region Style</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {BOX_STYLES.map((style) => (
                                        <Button
                                            key={style.value}
                                            variant={rendererConfig.boxStyle === style.value ? "default" : "outline"}
                                            size="sm"
                                            className={cn(
                                                "h-8 text-[10px] px-1",
                                                rendererConfig.boxStyle === style.value
                                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                                    : "bg-muted/30 hover:bg-muted/50 border-sidebar-border"
                                            )}
                                            onClick={() => setRendererConfig(prev => ({ ...prev, boxStyle: style.value }))}
                                        >
                                            {style.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <Separator className="bg-sidebar-border/50" />

                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Show Lines</Label>
                                <Switch
                                    checked={rendererConfig.showLines}
                                    onCheckedChange={(c: boolean) => setRendererConfig(prev => ({ ...prev, showLines: c }))}
                                    size="sm"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Labels & Scores</Label>
                                <Switch
                                    checked={rendererConfig.showLabels}
                                    onCheckedChange={(c: boolean) => setRendererConfig(prev => ({ ...prev, showLabels: c }))}
                                    size="sm"
                                />
                            </div>
                        </div>

                        <Separator className="bg-sidebar-border/50" />

                        {/* Stats Display */}
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">Live Stats</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-sidebar-accent/50 rounded-md p-2 flex flex-col items-center justify-center border border-sidebar-border/50">
                                    <span className="text-lg font-bold font-mono text-primary animate-pulse duration-1000">{stats.objectCount}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">Objects</span>
                                </div>
                                <div className="bg-sidebar-accent/50 rounded-md p-2 flex flex-col items-center justify-center border border-sidebar-border/50">
                                    <span className="text-lg font-bold font-mono">{stats.fps}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">FPS</span>
                                </div>
                            </div>
                        </div>

                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent >
            <SidebarRail />
        </Sidebar >
    );
}
