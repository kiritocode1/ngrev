"use client";

import { AlertCircle, Camera, Loader2, Pause, Play, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    CanvasRenderer,
    type Detection,
    detect,
    isModelReady,
    loadModel,
    MotionDetector,
    Tracker,
} from "@/lib/tracking";
import { cn } from "@/lib/utils";
import { useTracker } from "@/context/tracker-context";

type Status = "idle" | "loading-model" | "ready" | "processing" | "error";

interface VideoTrackerProps {
    className?: string;
}

export function VideoTrackerModern({ className }: VideoTrackerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const trackerRef = useRef<Tracker | null>(null);
    const rendererRef = useRef<CanvasRenderer | null>(null);
    const motionDetectorRef = useRef<MotionDetector | null>(null);
    const animationRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Context state
    const {
        config,
        detectionMode,
        detectionThreshold,
        motionThreshold,
        minBlobSize,
        rendererConfig,
        setStats
    } = useTracker();

    // Local state
    const [status, setStatus] = useState<Status>("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoSrc, setVideoSrc] = useState<string>("");
    const [isCamera, setIsCamera] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);
    const lastTracksRef = useRef<any[]>([]); // Store last tracks for instant rendering

    // Refs for real-time loop access (avoids stale closures)
    const rendererConfigRef = useRef(rendererConfig);
    const detectionThresholdRef = useRef(detectionThreshold);
    const minBlobSizeRef = useRef(minBlobSize);
    const detectionModeRef = useRef(detectionMode);
    const configRef = useRef(config);

    // Sync refs with state
    useEffect(() => { rendererConfigRef.current = rendererConfig; }, [rendererConfig]);
    useEffect(() => { detectionThresholdRef.current = detectionThreshold; }, [detectionThreshold]);
    useEffect(() => { minBlobSizeRef.current = minBlobSize; }, [minBlobSize]);
    useEffect(() => { detectionModeRef.current = detectionMode; }, [detectionMode]);
    useEffect(() => { configRef.current = config; }, [config]);

    // Initialize model on mount
    useEffect(() => {
        async function init() {
            setStatus("loading-model");
            try {
                await loadModel();
                trackerRef.current = new Tracker(config);
                motionDetectorRef.current = new MotionDetector({
                    threshold: motionThreshold,
                    minBlobArea: minBlobSize,
                });
                setStatus("ready");
            } catch (error) {
                setStatus("error");
                setErrorMessage(
                    error instanceof Error ? error.message : "Failed to load model",
                );
            }
        }
        init();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    // Update tracker config when it changes
    useEffect(() => {
        if (trackerRef.current) {
            trackerRef.current.setConfig(config);
        }
    }, [config]);

    // Update motion detector config
    // Update motion detector config
    useEffect(() => {
        if (motionDetectorRef.current) {
            motionDetectorRef.current.setConfig({
                threshold: motionThreshold,
                minBlobArea: minBlobSize,
            });
        }
    }, [motionThreshold, minBlobSize]);

    // Update renderer config (Instant Feedback)
    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.setConfig(rendererConfig);
            // Force re-render if paused to show changes immediately
            if (!isPlaying && lastTracksRef.current.length > 0) {
                rendererRef.current.render(lastTracksRef.current, config.maxLineDistance);
            }
        }
    }, [rendererConfig, isPlaying, config.maxLineDistance]);

    // Handle video file selection
    const handleFileChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            if (videoSrc) {
                URL.revokeObjectURL(videoSrc);
            }

            const url = URL.createObjectURL(file);
            setVideoSrc(url);
            setIsPlaying(false);

            if (trackerRef.current) {
                trackerRef.current.reset();
            }
            if (motionDetectorRef.current) {
                motionDetectorRef.current.reset();
            }
        },
        [videoSrc],
    );

    // Handle Camera Toggle
    const toggleCamera = useCallback(async () => {
        if (isCamera) {
            // Stop Camera
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            setIsCamera(false);
            setVideoSrc("");
            setStatus("idle");
        } else {
            // Start Camera
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play(); // Auto-play camera
                }
                setIsCamera(true);
                setVideoSrc("");
                setIsPlaying(true);
                // Start processing immediately
                animationRef.current = requestAnimationFrame(processFrame);
            } catch (err) {
                console.error("Camera access denied:", err);
                setErrorMessage("Camera permission denied");
                setStatus("error");
            }
        }
    }, [isCamera]);

    // Initialize canvas when video loads
    const handleVideoLoaded = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        rendererRef.current = new CanvasRenderer(canvas);

        if (motionDetectorRef.current) {
            motionDetectorRef.current.reset();
        }
    }, []);

    // Main processing loop
    const lastStatsUpdateRef = useRef<number>(0);
    const frameCountRef = useRef<number>(0);
    const lastFpsTimeRef = useRef<number>(0);

    const processFrame = useCallback(async () => {
        const video = videoRef.current;
        if (!video || video.paused || video.ended) {
            return;
        }

        try {
            let allDetections: Detection[] = [];
            const dMode = detectionModeRef.current;
            const dThreshold = detectionThresholdRef.current;
            const mBlob = minBlobSizeRef.current;
            const currConfig = configRef.current;
            const rConfig = rendererConfigRef.current;

            if (
                (dMode === "objects" || dMode === "both") &&
                isModelReady()
            ) {
                const objectDetections = await detect(
                    video,
                    dThreshold,
                    mBlob,
                );
                allDetections = [...allDetections, ...objectDetections];
            }

            if (
                (dMode === "motion" || dMode === "both") &&
                motionDetectorRef.current
            ) {
                const motionDetections = motionDetectorRef.current.detect(video);
                allDetections = [...allDetections, ...motionDetections];
            }

            if (trackerRef.current) {
                const tracks = trackerRef.current.update(allDetections);
                lastTracksRef.current = tracks; // Update last known tracks

                if (rendererRef.current) {
                    rendererRef.current.setConfig(rConfig); // Ensure latest config is used
                    rendererRef.current.render(tracks, currConfig.maxLineDistance);
                }

                // Stats Update (Throttled to ~4 times per second)
                const now = performance.now();
                frameCountRef.current++;

                if (now - lastStatsUpdateRef.current > 250) {
                    // Calculate FPS
                    const elapsed = now - lastFpsTimeRef.current;
                    const fps = Math.round((frameCountRef.current / elapsed) * 1000);

                    if (elapsed > 1000) { // Reset FPS counter every second roughly
                        frameCountRef.current = 0;
                        lastFpsTimeRef.current = now;
                    }

                    setStats({
                        objectCount: tracks.length,
                        fps: fps > 0 ? fps : 0
                    });
                    lastStatsUpdateRef.current = now;
                }
            }
        } catch (error) {
            console.error("Detection error:", error);
        }

        animationRef.current = requestAnimationFrame(processFrame);
    }, [setStats]); // Refs are stable, so we don't need them in deps

    // Handle play/pause
    const togglePlayback = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play();
            setIsPlaying(true);
            animationRef.current = requestAnimationFrame(processFrame);
        } else {
            video.pause();
            setIsPlaying(false);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        }
    }, [processFrame]);

    // Handle video ended
    const handleVideoEnded = useCallback(() => {
        setIsPlaying(false);
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
    }, []);

    return (
        <Card
            className={cn(
                "w-full bg-card overflow-hidden border-border/50 shadow-xl",
                className,
            )}
        >
            <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            Video Analysis
                            {status === "loading-model" && (
                                <Badge variant="outline" className="gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Loading Model
                                </Badge>
                            )}
                            {status === "error" && (
                                <Badge variant="destructive" className="gap-1">
                                    <AlertCircle className="h-3 w-3" /> Error
                                </Badge>
                            )}
                            {status === "ready" && (
                                <Badge
                                    variant="secondary"
                                    className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20"
                                >
                                    Ready
                                </Badge>
                            )}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileChange}
                            className="hidden"
                            ref={fileInputRef}
                            disabled={status === "loading-model"}
                        />
                        <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={status === "loading-model"}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Video
                        </Button>
                        <Button
                            variant={isCamera ? "secondary" : "outline"}
                            onClick={toggleCamera}
                            disabled={status === "loading-model"}
                            className={cn(isCamera && "border-primary text-primary")}
                        >
                            <Camera className="mr-2 h-4 w-4" />
                            {isCamera ? "Stop Stream" : "Live Camera"}
                        </Button>

                        {(videoSrc || isCamera) && (
                            <Button
                                onClick={togglePlayback}
                                variant={isPlaying ? "secondary" : "default"}
                            >
                                {isPlaying ? (
                                    <Pause className="mr-2 h-4 w-4" />
                                ) : (
                                    <Play className="mr-2 h-4 w-4" />
                                )}
                                {isPlaying ? "Pause" : "Play"}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Status Message */}
                <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between">
                    <span>
                        {status === "ready" && !videoSrc && !isCamera
                            ? "Upload a video or start camera to begin tracking"
                            : ""}
                        {errorMessage && (
                            <span className="text-destructive">{errorMessage}</span>
                        )}
                    </span>
                </div>
            </CardHeader>

            <CardContent className="p-0 relative bg-black aspect-video flex items-center justify-center">
                {!videoSrc && !isCamera ? (
                    <div
                        className="text-center p-8 text-muted-foreground cursor-pointer hover:bg-white/5 transition-colors w-full h-full flex flex-col items-center justify-center"
                        onClick={() => fileInputRef.current?.click()}
                    >                      <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No video selected</p>
                        <p className="text-sm mt-2 opacity-70">Click to upload</p>
                    </div>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            src={videoSrc}
                            onLoadedMetadata={handleVideoLoaded}
                            onEnded={handleVideoEnded}
                            className="w-full h-full object-contain max-h-[600px]"
                            playsInline
                            muted
                        />
                        <canvas
                            ref={canvasRef}
                            className="absolute top-0 left-0 w-full h-full pointer-events-none"
                        />
                    </>
                )}
            </CardContent>
        </Card>
    );
}
