"use client";

import React, { createContext, useContext, useState } from "react";
import { DEFAULT_TRACKER_CONFIG, DEFAULT_RENDERER_CONFIG, type TrackerConfig, type RendererConfig } from "@/lib/tracking/types";
import type { SaliencyConfig } from "@/lib/tracking/saliency-detector";

// Detection Modes
export type DetectionMode = "motion" | "saliency";

// Default saliency config
export const DEFAULT_SALIENCY_CONFIG: Required<SaliencyConfig> = {
    motionThreshold: 25,
    motionWeight: 0.4,
    luminanceThreshold: 200,
    luminanceWeight: 0.3,
    adaptiveLuminance: true,
    gradientThreshold: 50,
    gradientWeight: 0.15,
    flickerThreshold: 40,
    flickerWeight: 0.15,
    flickerWindowSize: 5,
    minBlobArea: 150,
    mergeDistance: 60,
    bufferSize: 4,
};

// Audio/Beat settings
export interface AudioSettings {
    beatGatingEnabled: boolean;
    beatSensitivity: number;      // 0.1 - 1.0
    minBeatInterval: number;      // ms between beats
    decayRate: number;            // 0.8 - 0.99
    minOpacity: number;           // 0.0 - 0.5
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
    beatGatingEnabled: true,
    beatSensitivity: 0.25,
    minBeatInterval: 150,
    decayRate: 0.92,
    minOpacity: 0.15,
};

export interface TrackingStats {
    objectCount: number;
    fps: number;
}

interface TrackerContextType {
    // Tracker Config
    config: TrackerConfig;
    setConfig: React.Dispatch<React.SetStateAction<TrackerConfig>>;

    // Legacy Motion Detection Settings (kept for compatibility)
    motionThreshold: number;
    setMotionThreshold: (threshold: number) => void;

    minBlobSize: number;
    setMinBlobSize: (size: number) => void;

    // Detection Mode
    detectionMode: DetectionMode;
    setDetectionMode: (mode: DetectionMode) => void;

    // Saliency Config (hybrid motion + light)
    saliencyConfig: Required<SaliencyConfig>;
    setSaliencyConfig: React.Dispatch<React.SetStateAction<Required<SaliencyConfig>>>;

    // Audio/Beat Settings
    audioSettings: AudioSettings;
    setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>;

    // Renderer Config
    rendererConfig: RendererConfig;
    setRendererConfig: React.Dispatch<React.SetStateAction<RendererConfig>>;

    // Live Stats
    stats: TrackingStats;
    setStats: React.Dispatch<React.SetStateAction<TrackingStats>>;
}

const TrackerContext = createContext<TrackerContextType | undefined>(undefined);

export function TrackerProvider({ children }: { children: React.ReactNode }) {
    const [config, setConfig] = useState<TrackerConfig>(DEFAULT_TRACKER_CONFIG);
    const [motionThreshold, setMotionThreshold] = useState(25);
    const [minBlobSize, setMinBlobSize] = useState(300);

    // Detection mode state
    const [detectionMode, setDetectionMode] = useState<DetectionMode>("saliency");

    // Saliency config state
    const [saliencyConfig, setSaliencyConfig] = useState<Required<SaliencyConfig>>(DEFAULT_SALIENCY_CONFIG);

    // Audio settings state
    const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);

    // Renderer state
    const [rendererConfig, setRendererConfig] = useState<RendererConfig>(DEFAULT_RENDERER_CONFIG);
    const [stats, setStats] = useState<TrackingStats>({ objectCount: 0, fps: 0 });

    return (
        <TrackerContext.Provider
            value={{
                config,
                setConfig,
                motionThreshold,
                setMotionThreshold,
                minBlobSize,
                setMinBlobSize,
                detectionMode,
                setDetectionMode,
                saliencyConfig,
                setSaliencyConfig,
                audioSettings,
                setAudioSettings,
                rendererConfig,
                setRendererConfig,
                stats,
                setStats,
            }}
        >
            {children}
        </TrackerContext.Provider>
    );
}

export function useTracker() {
    const context = useContext(TrackerContext);
    if (context === undefined) {
        throw new Error("useTracker must be used within a TrackerProvider");
    }
    return context;
}
