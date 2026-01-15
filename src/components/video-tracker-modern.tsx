"use client";

import { AlertCircle, Camera, Download, Loader2, Pause, Play, Upload, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    CanvasRenderer,
    type Detection,
    MotionDetector,
    Tracker,
} from "@/lib/tracking";
import { cn } from "@/lib/utils";
import { useTracker } from "@/context/tracker-context";
import { ExportSession, downloadBlob, type ExportProgress } from "@/lib/video-exporter";

type Status = "idle" | "ready" | "processing" | "error";

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
    const exportCanvasRef = useRef<HTMLCanvasElement | null>(null); // Composite canvas for export

    // Refs for real-time loop access (avoids stale closures)
    const rendererConfigRef = useRef(rendererConfig);
    const minBlobSizeRef = useRef(minBlobSize);
    const configRef = useRef(config);

    // Sync refs with state
    useEffect(() => { rendererConfigRef.current = rendererConfig; }, [rendererConfig]);
    useEffect(() => { minBlobSizeRef.current = minBlobSize; }, [minBlobSize]);
    useEffect(() => { configRef.current = config; }, [config]);

    // Initialize on mount
    useEffect(() => {
        trackerRef.current = new Tracker(config);
        motionDetectorRef.current = new MotionDetector({
            threshold: motionThreshold,
            minBlobArea: minBlobSize,
        });
        setStatus("ready");

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
            const currConfig = configRef.current;
            const rConfig = rendererConfigRef.current;

            // Use motion detection only
            if (motionDetectorRef.current) {
                const motionDetections = motionDetectorRef.current.detect(video);
                allDetections = motionDetections;
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
        // Note: Export completion is handled in the export loop itself to avoid race conditions
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
        const overlayCanvas = canvasRef.current;
        const file = videoFileRef.current;

        if (!video || !overlayCanvas) {
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
            // Create a composite canvas that will contain video + overlays
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = video.videoWidth;
            exportCanvas.height = video.videoHeight;
            const exportCtx = exportCanvas.getContext('2d');
            if (!exportCtx) {
                throw new Error("Failed to create export canvas context");
            }
            exportCanvasRef.current = exportCanvas;

            const session = new ExportSession({ frameRate: 30, format: "mp4" });
            exportSessionRef.current = session;

            // Extract audio from original video
            await session.extractAudioFromVideo(file, setExportProgress);

            // Start recording with the composite canvas
            await session.startRecording(exportCanvas, setExportProgress);

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

            // Start playback
            video.play();
            setIsPlaying(true);
            animationRef.current = requestAnimationFrame(processFrame);

            // Track if export should continue
            let exportStopped = false;

            // Export loop - captures composite frames
            const captureAndExport = async () => {
                // Check if we should stop
                if (exportStopped || !session.isActive()) {
                    return;
                }

                // Only stop when video has truly ended (check both ended flag and currentTime)
                const videoComplete = video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.1);

                if (videoComplete) {
                    exportStopped = true;
                    // Stop recording and download
                    try {
                        const blob = await session.stopRecording();
                        if (blob) {
                            const filename = `tracked-video-${Date.now()}.mp4`;
                            downloadBlob(blob, filename);
                        }
                        setExportProgress({ phase: "complete", progress: 100, message: "Export complete!" });
                    } catch (err) {
                        console.error("Stop recording error:", err);
                        setExportProgress({ phase: "error", progress: 0, message: `Export failed: ${err}` });
                    }
                    setIsExporting(false);
                    video.muted = false;
                    setIsMuted(false);
                    exportSessionRef.current = null;
                    return;
                }

                // If video paused unexpectedly (buffering), try to resume
                if (video.paused && !video.ended) {
                    video.play().catch(() => {/* ignore play errors */ });
                }

                try {
                    // Draw video frame to export canvas
                    exportCtx.drawImage(video, 0, 0, exportCanvas.width, exportCanvas.height);

                    // Draw overlay canvas on top (tracking lines/boxes)
                    if (overlayCanvas.width > 0 && overlayCanvas.height > 0) {
                        exportCtx.drawImage(overlayCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
                    }

                    // Add the composited frame (don't await to prevent blocking)
                    session.addFrame().catch(err => {
                        console.error("Frame capture error:", err);
                    });

                    const progress = video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;
                    setExportProgress({
                        phase: "recording",
                        progress,
                        currentFrame: session.getFrameCount(),
                        message: `Recording: ${Math.round(progress)}%`
                    });
                } catch (err) {
                    console.error("Export frame error:", err);
                }

                // Continue the loop
                requestAnimationFrame(captureAndExport);
            };

            requestAnimationFrame(captureAndExport);

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
        <div
            className={cn(
                "w-full bg-card overflow-hidden border border-border",
                className,
            )}
        >
            <div className="border-b border-border p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <span className="text-mono text-xs uppercase tracking-widest text-muted-foreground">
                            Analysis
                        </span>

                        {status === "error" && (
                            <span className="text-mono text-xs uppercase tracking-wider flex items-center gap-2 text-destructive">
                                <AlertCircle className="h-3 w-3" /> Error
                            </span>
                        )}
                        {status === "ready" && (
                            <span className="text-mono text-xs uppercase tracking-wider text-foreground">
                                [ Ready ]
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileChange}
                            className="hidden"
                            ref={fileInputRef}
                            disabled={status !== "ready"}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={status !== "ready"}
                            className="text-mono text-[10px] uppercase tracking-wider h-8 border-border hover:bg-accent"
                        >
                            <Upload className="mr-2 h-3 w-3" />
                            Upload
                        </Button>
                        <Button
                            variant={isCamera ? "default" : "outline"}
                            size="sm"
                            onClick={toggleCamera}
                            disabled={status !== "ready"}
                            className={cn(
                                "text-mono text-[10px] uppercase tracking-wider h-8",
                                isCamera ? "bg-foreground text-background" : "border-border hover:bg-accent"
                            )}
                        >
                            <Camera className="mr-2 h-3 w-3" />
                            {isCamera ? "Stop" : "Camera"}
                        </Button>

                        {(videoSrc || isCamera) && (
                            <Button
                                onClick={togglePlayback}
                                variant={isPlaying ? "default" : "outline"}
                                size="sm"
                                disabled={isExporting}
                                className={cn(
                                    "text-mono text-[10px] uppercase tracking-wider h-8",
                                    isPlaying ? "bg-foreground text-background" : "border-border hover:bg-accent"
                                )}
                            >
                                {isPlaying ? (
                                    <Pause className="mr-2 h-3 w-3" />
                                ) : (
                                    <Play className="mr-2 h-3 w-3" />
                                )}
                                {isPlaying ? "Pause" : "Play"}
                            </Button>
                        )}

                        {/* Audio Toggle */}
                        {videoSrc && !isCamera && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleMute}
                                title={isMuted ? "Unmute audio" : "Mute audio"}
                                className="text-mono text-[10px] uppercase h-8 w-8 p-0 border-border hover:bg-accent"
                            >
                                {isMuted ? (
                                    <VolumeX className="h-3 w-3" />
                                ) : (
                                    <Volume2 className="h-3 w-3" />
                                )}
                            </Button>
                        )}

                        {/* Export Button */}
                        {videoSrc && !isCamera && (
                            isExporting ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={cancelExport}
                                    className="text-mono text-[10px] uppercase tracking-wider h-8 border-destructive text-destructive hover:bg-destructive/10"
                                >
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    Cancel
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleExport}
                                    disabled={status !== "ready"}
                                    className="text-mono text-[10px] uppercase tracking-wider h-8 border-border hover:bg-accent"
                                >
                                    <Download className="mr-2 h-3 w-3" />
                                    Export
                                </Button>
                            )
                        )}
                    </div>
                </div>

                {/* Status Message / Export Progress */}
                <div className="mt-3 flex items-center justify-between">
                    <span className="text-mono text-[10px] uppercase text-muted-foreground">
                        {status === "ready" && !videoSrc && !isCamera
                            ? "[ Awaiting input ]"
                            : ""}
                        {errorMessage && (
                            <span className="text-destructive">{errorMessage}</span>
                        )}
                    </span>
                    {/* Export Progress */}
                    {exportProgress && (
                        <div className="flex items-center gap-3">
                            <div className="w-32 h-1 bg-accent overflow-hidden">
                                <div
                                    className="h-full bg-foreground transition-all duration-300"
                                    style={{ width: `${exportProgress.progress}%` }}
                                />
                            </div>
                            <span className="text-mono text-[10px] uppercase text-muted-foreground">
                                {exportProgress.message || `${Math.round(exportProgress.progress)}%`}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Video Container */}
            <div className="p-0 relative bg-black aspect-video flex items-center justify-center">
                {!videoSrc && !isCamera ? (
                    <div
                        className="text-center p-8 cursor-pointer hover:bg-white/5 transition-colors w-full h-full flex flex-col items-center justify-center border border-dashed border-border/50 m-4"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-mono text-xs uppercase tracking-widest text-muted-foreground">No video selected</p>
                        <p className="text-mono text-[10px] uppercase mt-2 text-muted-foreground/70">[ Click to upload ]</p>
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
            </div>
        </div>
    );
}
