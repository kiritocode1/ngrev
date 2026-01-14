"use client";

import React, { createContext, useContext, useState } from "react";
import { DEFAULT_TRACKER_CONFIG, DEFAULT_RENDERER_CONFIG, type TrackerConfig, type RendererConfig } from "@/lib/tracking/types";

export interface TrackingStats {
    objectCount: number;
    fps: number;
}

export type DetectionMode = "objects" | "motion" | "both";

interface TrackerContextType {
    // Tracker Config
    config: TrackerConfig;
    setConfig: React.Dispatch<React.SetStateAction<TrackerConfig>>;

    // Detection Settings
    detectionMode: DetectionMode;
    setDetectionMode: (mode: DetectionMode) => void;

    detectionThreshold: number;
    setDetectionThreshold: (threshold: number) => void;

    motionThreshold: number;
    setMotionThreshold: (threshold: number) => void;

    minBlobSize: number;
    setMinBlobSize: (size: number) => void;

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
    const [detectionMode, setDetectionMode] = useState<DetectionMode>("both");
    const [detectionThreshold, setDetectionThreshold] = useState(0.5);
    const [motionThreshold, setMotionThreshold] = useState(25);
    const [minBlobSize, setMinBlobSize] = useState(300);

    // New State
    const [rendererConfig, setRendererConfig] = useState<RendererConfig>(DEFAULT_RENDERER_CONFIG);
    const [stats, setStats] = useState<TrackingStats>({ objectCount: 0, fps: 0 });

    return (
        <TrackerContext.Provider
            value={{
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
