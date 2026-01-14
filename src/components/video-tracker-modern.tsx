"use client";

import { AlertCircle, Camera, Download, Loader2, Pause, Play, Upload, Volume2, VolumeX } from "lucide-react";
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
import { ExportSession, downloadBlob, type ExportProgress } from "@/lib/video-exporter";

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
    const [isMuted, setIsMuted] = useState(false); // Start unmuted for voiceover
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastTracksRef = useRef<any[]>([]); // Store last tracks for instant rendering
    const videoFileRef = useRef<File | null>(null); // Store original video file for export
    const exportSessionRef = useRef<ExportSession | null>(null);

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

            // Store file for export
            videoFileRef.current = file;

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

    // Attach stream to video when camera mode is active
    useEffect(() => {
        if (isCamera && streamRef.current && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(e => console.error("Error playing stream:", e));
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
        // Stop export recording if active
        if (exportSessionRef.current?.isActive()) {
            exportSessionRef.current.stopRecording().then(blob => {
                if (blob) {
                    const filename = `tracked-video-${Date.now()}.mp4`;
                    downloadBlob(blob, filename);
                }
                setIsExporting(false);
                setExportProgress(null);
            });
        }
    }, []);

    // Toggle audio mute (for voiceover feature)
    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (video) {
            video.muted = !video.muted;
            setIsMuted(video.muted);
        }
    }, []);

    // Export video with audio
    const handleExport = useCallback(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const file = videoFileRef.current;

        if (!video || !canvas) {
            setErrorMessage("No video or canvas available for export");
            return;
        }

        if (!file) {
            setErrorMessage("Original video file not available. Please re-upload the video.");
            return;
        }

        setIsExporting(true);
        setExportProgress({ phase: "preparing", progress: 0, message: "Preparing export..." });

        try {
            const session = new ExportSession({ frameRate: 30, format: "mp4" });
            exportSessionRef.current = session;

            // Extract audio from original video
            await session.extractAudioFromVideo(file, setExportProgress);

            // Start recording
            await session.startRecording(canvas, setExportProgress);

            // Reset video to beginning and play
            video.currentTime = 0;
            video.muted = true; // Mute during export to avoid double audio
            setIsMuted(true);

            // Wait for seek to complete
            await new Promise<void>(resolve => {
                const onSeeked = () => {
                    video.removeEventListener("seeked", onSeeked);
                    resolve();
                };
                video.addEventListener("seeked", onSeeked);
            });

            // Start playback - the processFrame will run, and handleVideoEnded will stop export
            video.play();
            setIsPlaying(true);
            animationRef.current = requestAnimationFrame(processFrame);

            // Monitor for video end or manual stop
            const checkExport = async () => {
                if (!session.isActive()) return;

                if (video.ended) {
                    const blob = await session.stopRecording();
                    if (blob) {
                        const filename = `tracked-video-${Date.now()}.mp4`;
                        downloadBlob(blob, filename);
                    }
                    setIsExporting(false);
                    setExportProgress({ phase: "complete", progress: 100, message: "Export complete!" });
                    video.muted = false;
                    setIsMuted(false);
                } else {
                    // Add frame and continue
                    await session.addFrame();
                    const progress = (video.currentTime / video.duration) * 100;
                    setExportProgress({
                        phase: "recording",
                        progress,
                        currentFrame: session.getFrameCount(),
                        message: `Recording: ${Math.round(progress)}%`
                    });
                    requestAnimationFrame(checkExport);
                }
            };

            requestAnimationFrame(checkExport);

        } catch (error) {
            console.error("Export failed:", error);
            setErrorMessage(`Export failed: ${error}`);
            setIsExporting(false);
            setExportProgress({ phase: "error", progress: 0, message: `Export failed: ${error}` });
        }
    }, [processFrame]);

    // Cancel export
    const cancelExport = useCallback(async () => {
        if (exportSessionRef.current) {
            await exportSessionRef.current.cancel();
        }
        const video = videoRef.current;
        if (video) {
            video.pause();
            video.muted = false;
        }
        setIsExporting(false);
        setIsPlaying(false);
        setIsMuted(false);
        setExportProgress(null);
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
                                disabled={isExporting}
                            >
                                {isPlaying ? (
                                    <Pause className="mr-2 h-4 w-4" />
                                ) : (
                                    <Play className="mr-2 h-4 w-4" />
                                )}
                                {isPlaying ? "Pause" : "Play"}
                            </Button>
                        )}

                        {/* Audio Toggle - for voiceover feature */}
                        {videoSrc && !isCamera && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={toggleMute}
                                title={isMuted ? "Unmute audio" : "Mute audio"}
                            >
                                {isMuted ? (
                                    <VolumeX className="h-4 w-4" />
                                ) : (
                                    <Volume2 className="h-4 w-4" />
                                )}
                            </Button>
                        )}

                        {/* Export Button */}
                        {videoSrc && !isCamera && (
                            isExporting ? (
                                <Button
                                    variant="destructive"
                                    onClick={cancelExport}
                                >
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Cancel Export
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={handleExport}
                                    disabled={status === "loading-model"}
                                    className="border-primary/50 text-primary hover:bg-primary/10"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Export
                                </Button>
                            )
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
                    {/* Export Progress */}
                    {exportProgress && (
                        <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${exportProgress.progress}%` }}
                                />
                            </div>
                            <span className="text-xs">
                                {exportProgress.message || `${Math.round(exportProgress.progress)}%`}
                            </span>
                        </div>
                    )}
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
                            src={videoSrc || undefined}
                            onLoadedMetadata={handleVideoLoaded}
                            onEnded={handleVideoEnded}
                            className="w-full h-full object-contain max-h-[600px]"
                            playsInline
                            muted={isMuted}
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
