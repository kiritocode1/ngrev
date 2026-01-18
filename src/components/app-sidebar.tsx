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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTracker, DEFAULT_SALIENCY_CONFIG, DEFAULT_AUDIO_SETTINGS, type DetectionPreset } from "@/context/tracker-context";
import { type BoundingBoxStyle } from "@/lib/tracking/types";
import { cn } from "@/lib/utils";
import { Eye, Sparkles, RotateCcw, Waves, Sun, Hexagon, Sliders } from "lucide-react";


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

const FONT_SIZES = [4, 6, 8, 10, 12, 14];

const STROKE_WIDTHS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5];



export function AppSidebar() {
    const {
        config,
        setConfig,
        motionThreshold,
        setMotionThreshold,
        minBlobSize,
        setMinBlobSize,
        detectionMode,
        setDetectionMode,
        currentPreset,
        applyPreset,
        saliencyConfig,
        setSaliencyConfig,
        audioSettings,
        setAudioSettings,
        rendererConfig,
        setRendererConfig,
        stats,
    } = useTracker();

    // Preset definitions for UI
    const PRESET_OPTIONS: { value: DetectionPreset; label: string; icon: React.ReactNode; description: string }[] = [
        { value: "default", label: "DEFAULT", icon: <Sliders className="w-3 h-3" />, description: "Balanced" },
        { value: "dust", label: "DUST", icon: <Waves className="w-3 h-3" />, description: "Particles" },
        { value: "lightRays", label: "RAYS", icon: <Sun className="w-3 h-3" />, description: "Light beams" },
        { value: "edges", label: "EDGES", icon: <Hexagon className="w-3 h-3" />, description: "Contours" },
    ];

    // Helper to calculate total weight and normalize display
    const totalWeight = saliencyConfig.motionWeight + saliencyConfig.luminanceWeight +
        saliencyConfig.gradientWeight + saliencyConfig.flickerWeight;

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

                {/* ═══════════════════════════════════════════════════════════════
                    SECTION 01: DETECTION MODE
                ═══════════════════════════════════════════════════════════════ */}
                <SidebarGroup className="group-data-[collapsible=icon]:hidden border-b border-border">
                    <SidebarGroupLabel className="text-mono text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3">
                        01. Detection
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="space-y-4 px-4 pb-4">

                        {/* Detection Mode Toggle */}
                        <div className="space-y-2">
                            <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Mode</Label>
                            <ToggleGroup
                                value={[detectionMode]}
                                onValueChange={(val) => {
                                    const newVal = Array.isArray(val) ? val[val.length - 1] : val;
                                    if (newVal) setDetectionMode(newVal as "motion" | "saliency");
                                }}
                                className="justify-start w-full bg-accent p-0.5"
                            >
                                <ToggleGroupItem
                                    value="motion"
                                    className="flex-1 text-mono text-[9px] h-7 gap-1 data-[state=on]:bg-foreground data-[state=on]:text-background"
                                >
                                    <Eye className="w-3 h-3" />
                                    MOTION
                                </ToggleGroupItem>
                                <ToggleGroupItem
                                    value="saliency"
                                    className="flex-1 text-mono text-[9px] h-7 gap-1 data-[state=on]:bg-foreground data-[state=on]:text-background"
                                >
                                    <Sparkles className="w-3 h-3" />
                                    HYBRID
                                </ToggleGroupItem>
                            </ToggleGroup>
                            <p className="text-mono text-[8px] text-muted-foreground/70">
                                {detectionMode === "saliency"
                                    ? "Tracks motion + light sources + flicker"
                                    : "Tracks movement only"
                                }
                            </p>
                        </div>

                        {/* Detection Preset Selector (only in hybrid mode) */}
                        {detectionMode === "saliency" && (
                            <div className="space-y-2">
                                <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Style</Label>
                                <div className="grid grid-cols-2 gap-1">
                                    {PRESET_OPTIONS.map((preset) => (
                                        <Button
                                            key={preset.value}
                                            variant={currentPreset === preset.value ? "default" : "outline"}
                                            size="sm"
                                            className={cn(
                                                "h-8 text-mono text-[8px] px-2 gap-1 flex-col py-1",
                                                currentPreset === preset.value
                                                    ? "bg-foreground text-background hover:bg-foreground/90"
                                                    : "bg-transparent hover:bg-accent border-border"
                                            )}
                                            onClick={() => applyPreset(preset.value)}
                                        >
                                            <span className="flex items-center gap-1">
                                                {preset.icon}
                                                {preset.label}
                                            </span>
                                        </Button>
                                    ))}
                                </div>
                                {currentPreset === "custom" && (
                                    <p className="text-mono text-[8px] text-yellow-500">● Custom settings</p>
                                )}
                                {currentPreset === "dust" && (
                                    <p className="text-mono text-[8px] text-muted-foreground/70">
                                        Many small particles, like dust in light
                                    </p>
                                )}
                            </div>
                        )}

                        <Separator className="bg-border" />

                        {/* Motion Sensitivity */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Awareness</Label>
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

                        {/* Min Blob Size */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Threshold</Label>
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
                                <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Resonance</Label>
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

                {/* ═══════════════════════════════════════════════════════════════
                    SECTION 02: SALIENCY WEIGHTS (only shown in hybrid mode)
                ═══════════════════════════════════════════════════════════════ */}
                {detectionMode === "saliency" && (
                    <SidebarGroup className="group-data-[collapsible=icon]:hidden border-b border-border">
                        <SidebarGroupLabel className="text-mono text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3 flex items-center justify-between">
                            <span>02. Saliency Weights</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 opacity-50 hover:opacity-100"
                                onClick={() => setSaliencyConfig(DEFAULT_SALIENCY_CONFIG)}
                                title="Reset to defaults"
                            >
                                <RotateCcw className="w-3 h-3" />
                            </Button>
                        </SidebarGroupLabel>
                        <SidebarGroupContent className="space-y-3 px-4 pb-4">

                            {/* Weight visualization bar */}
                            <div className="h-2 flex overflow-hidden border border-border">
                                <div
                                    className="bg-blue-500 transition-all"
                                    style={{ width: `${(saliencyConfig.motionWeight / totalWeight) * 100}%` }}
                                    title="Motion"
                                />
                                <div
                                    className="bg-yellow-400 transition-all"
                                    style={{ width: `${(saliencyConfig.luminanceWeight / totalWeight) * 100}%` }}
                                    title="Light"
                                />
                                <div
                                    className="bg-purple-500 transition-all"
                                    style={{ width: `${(saliencyConfig.gradientWeight / totalWeight) * 100}%` }}
                                    title="Gradient"
                                />
                                <div
                                    className="bg-red-500 transition-all"
                                    style={{ width: `${(saliencyConfig.flickerWeight / totalWeight) * 100}%` }}
                                    title="Flicker"
                                />
                            </div>
                            <div className="flex justify-between text-mono text-[7px] text-muted-foreground">
                                <span className="text-blue-400">●MOT</span>
                                <span className="text-yellow-400">●LUM</span>
                                <span className="text-purple-400">●GRD</span>
                                <span className="text-red-400">●FLK</span>
                            </div>

                            {/* Motion Weight */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-mono text-[9px] uppercase text-blue-400">Motion</Label>
                                    <span className="text-mono text-[9px] text-foreground">
                                        {Math.round((saliencyConfig.motionWeight / totalWeight) * 100)}%
                                    </span>
                                </div>
                                <Slider
                                    value={[saliencyConfig.motionWeight * 100]}
                                    min={0}
                                    max={100}
                                    step={5}
                                    onValueChange={(vals) => setSaliencyConfig(c => ({ ...c, motionWeight: (Array.isArray(vals) ? vals[0] : vals) / 100 }))}
                                    className="py-0.5"
                                />
                            </div>

                            {/* Luminance Weight */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-mono text-[9px] uppercase text-yellow-400">Light</Label>
                                    <span className="text-mono text-[9px] text-foreground">
                                        {Math.round((saliencyConfig.luminanceWeight / totalWeight) * 100)}%
                                    </span>
                                </div>
                                <Slider
                                    value={[saliencyConfig.luminanceWeight * 100]}
                                    min={0}
                                    max={100}
                                    step={5}
                                    onValueChange={(vals) => setSaliencyConfig(c => ({ ...c, luminanceWeight: (Array.isArray(vals) ? vals[0] : vals) / 100 }))}
                                    className="py-0.5"
                                />
                            </div>

                            {/* Gradient Weight */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-mono text-[9px] uppercase text-purple-400">Gradient</Label>
                                    <span className="text-mono text-[9px] text-foreground">
                                        {Math.round((saliencyConfig.gradientWeight / totalWeight) * 100)}%
                                    </span>
                                </div>
                                <Slider
                                    value={[saliencyConfig.gradientWeight * 100]}
                                    min={0}
                                    max={100}
                                    step={5}
                                    onValueChange={(vals) => setSaliencyConfig(c => ({ ...c, gradientWeight: (Array.isArray(vals) ? vals[0] : vals) / 100 }))}
                                    className="py-0.5"
                                />
                            </div>

                            {/* Flicker Weight */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-mono text-[9px] uppercase text-red-400">Flicker</Label>
                                    <span className="text-mono text-[9px] text-foreground">
                                        {Math.round((saliencyConfig.flickerWeight / totalWeight) * 100)}%
                                    </span>
                                </div>
                                <Slider
                                    value={[saliencyConfig.flickerWeight * 100]}
                                    min={0}
                                    max={100}
                                    step={5}
                                    onValueChange={(vals) => setSaliencyConfig(c => ({ ...c, flickerWeight: (Array.isArray(vals) ? vals[0] : vals) / 100 }))}
                                    className="py-0.5"
                                />
                            </div>

                            <Separator className="bg-border" />

                            {/* Luminance Threshold */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-mono text-[9px] uppercase text-muted-foreground">Light Threshold</Label>
                                    <span className="text-mono text-[9px] text-foreground">{saliencyConfig.luminanceThreshold}</span>
                                </div>
                                <Slider
                                    value={[saliencyConfig.luminanceThreshold]}
                                    min={100}
                                    max={255}
                                    step={5}
                                    onValueChange={(vals) => setSaliencyConfig(c => ({ ...c, luminanceThreshold: Array.isArray(vals) ? vals[0] : vals }))}
                                    className="py-0.5"
                                />
                            </div>

                            {/* Adaptive Luminance Toggle */}
                            <div className="flex items-center justify-between">
                                <Label className="text-mono text-[9px] uppercase text-muted-foreground">Adaptive Light</Label>
                                <Switch
                                    checked={saliencyConfig.adaptiveLuminance}
                                    onCheckedChange={(c) => setSaliencyConfig(prev => ({ ...prev, adaptiveLuminance: c }))}
                                    size="sm"
                                />
                            </div>

                            {/* Flicker Threshold */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-mono text-[9px] uppercase text-muted-foreground">Flicker Sensitivity</Label>
                                    <span className="text-mono text-[9px] text-foreground">{saliencyConfig.flickerThreshold}</span>
                                </div>
                                <Slider
                                    value={[saliencyConfig.flickerThreshold]}
                                    min={10}
                                    max={100}
                                    step={5}
                                    onValueChange={(vals) => setSaliencyConfig(c => ({ ...c, flickerThreshold: Array.isArray(vals) ? vals[0] : vals }))}
                                    className="py-0.5"
                                />
                            </div>

                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {/* ═══════════════════════════════════════════════════════════════
                    SECTION 03: AUDIO / BEAT REACTIVITY
                ═══════════════════════════════════════════════════════════════ */}
                <SidebarGroup className="group-data-[collapsible=icon]:hidden border-b border-border">
                    <SidebarGroupLabel className="text-mono text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3 flex items-center justify-between">
                        <span>{detectionMode === "saliency" ? "03" : "02"}. Audio Reactivity</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-50 hover:opacity-100"
                            onClick={() => setAudioSettings(DEFAULT_AUDIO_SETTINGS)}
                            title="Reset to defaults"
                        >
                            <RotateCcw className="w-3 h-3" />
                        </Button>
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="space-y-3 px-4 pb-4">

                        {/* Beat Gating Toggle */}
                        <div className="flex items-center justify-between">
                            <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Beat-Gating</Label>
                            <Switch
                                checked={audioSettings.beatGatingEnabled}
                                onCheckedChange={(c) => setAudioSettings(prev => ({ ...prev, beatGatingEnabled: c }))}
                                size="sm"
                            />
                        </div>

                        {audioSettings.beatGatingEnabled && (
                            <>
                                {/* Beat Sensitivity */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-mono text-[9px] uppercase text-muted-foreground">Beat Sensitivity</Label>
                                        <span className="text-mono text-[9px] text-foreground">
                                            {Math.round(audioSettings.beatSensitivity * 100)}%
                                        </span>
                                    </div>
                                    <Slider
                                        value={[audioSettings.beatSensitivity * 100]}
                                        min={10}
                                        max={100}
                                        step={5}
                                        onValueChange={(vals) => setAudioSettings(c => ({ ...c, beatSensitivity: (Array.isArray(vals) ? vals[0] : vals) / 100 }))}
                                        className="py-0.5"
                                    />
                                </div>

                                {/* Min Beat Interval */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-mono text-[9px] uppercase text-muted-foreground">Beat Interval</Label>
                                        <span className="text-mono text-[9px] text-foreground">{audioSettings.minBeatInterval}ms</span>
                                    </div>
                                    <Slider
                                        value={[audioSettings.minBeatInterval]}
                                        min={50}
                                        max={500}
                                        step={25}
                                        onValueChange={(vals) => setAudioSettings(c => ({ ...c, minBeatInterval: Array.isArray(vals) ? vals[0] : vals }))}
                                        className="py-0.5"
                                    />
                                </div>

                                {/* Decay Rate */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-mono text-[9px] uppercase text-muted-foreground">Decay Rate</Label>
                                        <span className="text-mono text-[9px] text-foreground">
                                            {Math.round(audioSettings.decayRate * 100)}%
                                        </span>
                                    </div>
                                    <Slider
                                        value={[audioSettings.decayRate * 100]}
                                        min={80}
                                        max={99}
                                        step={1}
                                        onValueChange={(vals) => setAudioSettings(c => ({ ...c, decayRate: (Array.isArray(vals) ? vals[0] : vals) / 100 }))}
                                        className="py-0.5"
                                    />
                                </div>

                                {/* Min Opacity */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-mono text-[9px] uppercase text-muted-foreground">Base Opacity</Label>
                                        <span className="text-mono text-[9px] text-foreground">
                                            {Math.round(audioSettings.minOpacity * 100)}%
                                        </span>
                                    </div>
                                    <Slider
                                        value={[audioSettings.minOpacity * 100]}
                                        min={0}
                                        max={50}
                                        step={5}
                                        onValueChange={(vals) => setAudioSettings(c => ({ ...c, minOpacity: (Array.isArray(vals) ? vals[0] : vals) / 100 }))}
                                        className="py-0.5"
                                    />
                                </div>
                            </>
                        )}

                    </SidebarGroupContent>
                </SidebarGroup>

                {/* ═══════════════════════════════════════════════════════════════
                    SECTION 04: VISUAL APPEARANCE
                ═══════════════════════════════════════════════════════════════ */}
                <SidebarGroup className="group-data-[collapsible=icon]:hidden border-b border-border">
                    <SidebarGroupLabel className="text-mono text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3">
                        {detectionMode === "saliency" ? "04" : "03"}. Presence
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="space-y-4 px-4 pb-4">

                        {/* Visualization Toggles */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Form</Label>
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
                                            {rendererConfig.fixedBoxSize}px
                                        </span>
                                    </div>
                                    <Slider
                                        value={[rendererConfig.fixedBoxSize || 1]}
                                        min={1}
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
                                <div className="space-y-3">
                                    {/* Box Width Presets */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-mono text-[9px] uppercase text-muted-foreground">Box Stroke</Label>
                                            <span className="text-mono text-[9px] text-foreground">{rendererConfig.boxWidth}px</span>
                                        </div>
                                        <div className="flex gap-1">
                                            {STROKE_WIDTHS.map(w => (
                                                <Button
                                                    key={`box-${w}`}
                                                    variant={rendererConfig.boxWidth === w ? "default" : "outline"}
                                                    size="sm"
                                                    className={cn(
                                                        "flex-1 h-6 text-mono text-[8px] px-0",
                                                        rendererConfig.boxWidth === w
                                                            ? "bg-foreground text-background"
                                                            : "bg-transparent border-border"
                                                    )}
                                                    onClick={() => setRendererConfig(prev => ({ ...prev, boxWidth: w }))}
                                                >
                                                    {w}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Line Width Presets */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-mono text-[9px] uppercase text-muted-foreground">Line Stroke</Label>
                                            <span className="text-mono text-[9px] text-foreground">{rendererConfig.lineWidth}px</span>
                                        </div>
                                        <div className="flex gap-1">
                                            {STROKE_WIDTHS.map(w => (
                                                <Button
                                                    key={`line-${w}`}
                                                    variant={rendererConfig.lineWidth === w ? "default" : "outline"}
                                                    size="sm"
                                                    className={cn(
                                                        "flex-1 h-6 text-mono text-[8px] px-0",
                                                        rendererConfig.lineWidth === w
                                                            ? "bg-foreground text-background"
                                                            : "bg-transparent border-border"
                                                    )}
                                                    onClick={() => setRendererConfig(prev => ({ ...prev, lineWidth: w }))}
                                                >
                                                    {w}
                                                </Button>
                                            ))}
                                        </div>
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

                {/* ═══════════════════════════════════════════════════════════════
                    SECTION 05: LIVE STATS
                ═══════════════════════════════════════════════════════════════ */}
                <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel className="text-mono text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3">
                        {detectionMode === "saliency" ? "05" : "04"}. Pulse
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="px-4 pb-4">
                        {/* Stats Display */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-accent border border-border p-3 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-mono text-foreground">{stats.objectCount}</span>
                                <span className="text-mono text-[9px] uppercase text-muted-foreground">Vessels</span>
                            </div>
                            <div className="bg-accent border border-border p-3 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-mono text-foreground">{stats.fps}</span>
                                <span className="text-mono text-[9px] uppercase text-muted-foreground">Rhythm</span>
                            </div>
                        </div>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarRail />
        </Sidebar>
    );
}
