"use client";

/**
 * Video Tracker Component
 *
 * Main component that orchestrates video playback, detection, tracking, and visualization
 * Supports both ML-based object detection AND motion detection
 */

import { useRef, useState, useCallback, useEffect } from "react";
import {
    loadModel,
    isModelReady,
    detect,
    Tracker,
    CanvasRenderer,
    MotionDetector,
    type TrackerConfig,
    type Detection,
    DEFAULT_TRACKER_CONFIG,
} from "@/lib/tracking";

interface VideoTrackerProps {
    className?: string;
}

type Status = "idle" | "loading-model" | "ready" | "processing" | "error";
type DetectionMode = "objects" | "motion" | "both";

export function VideoTracker({ className = "" }: VideoTrackerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const trackerRef = useRef<Tracker | null>(null);
    const rendererRef = useRef<CanvasRenderer | null>(null);
    const motionDetectorRef = useRef<MotionDetector | null>(null);
    const animationRef = useRef<number | null>(null);

    const [status, setStatus] = useState<Status>("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoSrc, setVideoSrc] = useState<string>("");
    const [config, setConfig] = useState<TrackerConfig>(DEFAULT_TRACKER_CONFIG);
    const [detectionThreshold, setDetectionThreshold] = useState(0.5);
    const [detectionMode, setDetectionMode] = useState<DetectionMode>("both");
    const [motionThreshold, setMotionThreshold] = useState(25);
    const [minBlobSize, setMinBlobSize] = useState(300);

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
                    error instanceof Error ? error.message : "Failed to load model"
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
    useEffect(() => {
        if (motionDetectorRef.current) {
            motionDetectorRef.current.setConfig({
                threshold: motionThreshold,
                minBlobArea: minBlobSize,
            });
        }
    }, [motionThreshold, minBlobSize]);

    // Handle video file selection
    const handleFileChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            // Revoke old URL if exists
            if (videoSrc) {
                URL.revokeObjectURL(videoSrc);
            }

            const url = URL.createObjectURL(file);
            setVideoSrc(url);
            setIsPlaying(false);

            // Reset tracker and motion detector
            if (trackerRef.current) {
                trackerRef.current.reset();
            }
            if (motionDetectorRef.current) {
                motionDetectorRef.current.reset();
            }
        },
        [videoSrc]
    );

    // Initialize canvas when video loads
    const handleVideoLoaded = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        // Match canvas size to video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Initialize renderer
        rendererRef.current = new CanvasRenderer(canvas);

        // Reset motion detector for new video
        if (motionDetectorRef.current) {
            motionDetectorRef.current.reset();
        }
    }, []);

    // Main processing loop
    const processFrame = useCallback(async () => {
        const video = videoRef.current;
        if (!video || video.paused || video.ended) {
            return;
        }

        try {
            let allDetections: Detection[] = [];

            // Run object detection (COCO-SSD)
            if (
                (detectionMode === "objects" || detectionMode === "both") &&
                isModelReady()
            ) {
                const objectDetections = await detect(video, detectionThreshold);
                allDetections = [...allDetections, ...objectDetections];
            }

            // Run motion detection
            if (
                (detectionMode === "motion" || detectionMode === "both") &&
                motionDetectorRef.current
            ) {
                const motionDetections = motionDetectorRef.current.detect(video);
                allDetections = [...allDetections, ...motionDetections];
            }

            // Update tracker with combined detections
            if (trackerRef.current) {
                const tracks = trackerRef.current.update(allDetections);

                // Render visualization
                if (rendererRef.current) {
                    rendererRef.current.render(tracks, config.maxLineDistance);
                }
            }
        } catch (error) {
            console.error("Detection error:", error);
        }

        // Continue loop
        animationRef.current = requestAnimationFrame(processFrame);
    }, [detectionThreshold, detectionMode, config.maxLineDistance]);

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
        <div className={`video-tracker ${className}`}>
            {/* Status indicator */}
            <div className="status-bar">
                {status === "loading-model" && (
                    <div className="status loading">
                        <span className="spinner" />
                        Loading AI Model...
                    </div>
                )}
                {status === "error" && (
                    <div className="status error">Error: {errorMessage}</div>
                )}
                {status === "ready" && !videoSrc && (
                    <div className="status ready">
                        Model ready. Upload a video to begin.
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="controls">
                <label className="file-input">
                    <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileChange}
                        disabled={status === "loading-model"}
                    />
                    <span className="file-button">Choose Video</span>
                </label>

                {videoSrc && (
                    <button
                        type="button"
                        onClick={togglePlayback}
                        className="play-button"
                    >
                        {isPlaying ? "⏸ Pause" : "▶ Play"}
                    </button>
                )}
            </div>

            {/* Detection Mode Toggle */}
            <div className="mode-toggle">
                <span className="mode-label">Detection Mode:</span>
                <div className="mode-buttons">
                    <button
                        type="button"
                        className={`mode-btn ${detectionMode === "objects" ? "active" : ""}`}
                        onClick={() => setDetectionMode("objects")}
                    >
                        🎯 Objects
                    </button>
                    <button
                        type="button"
                        className={`mode-btn ${detectionMode === "motion" ? "active" : ""}`}
                        onClick={() => setDetectionMode("motion")}
                    >
                        💨 Motion
                    </button>
                    <button
                        type="button"
                        className={`mode-btn ${detectionMode === "both" ? "active" : ""}`}
                        onClick={() => setDetectionMode("both")}
                    >
                        ⚡ Both
                    </button>
                </div>
            </div>

            {/* Settings */}
            <div className="settings">
                {(detectionMode === "objects" || detectionMode === "both") && (
                    <label>
                        Object Threshold: {detectionThreshold.toFixed(2)}
                        <input
                            type="range"
                            min="0.1"
                            max="0.9"
                            step="0.05"
                            value={detectionThreshold}
                            onChange={(e) => setDetectionThreshold(Number(e.target.value))}
                        />
                    </label>
                )}

                {(detectionMode === "motion" || detectionMode === "both") && (
                    <>
                        <label>
                            Motion Sensitivity: {motionThreshold}
                            <input
                                type="range"
                                min="10"
                                max="80"
                                step="5"
                                value={motionThreshold}
                                onChange={(e) => setMotionThreshold(Number(e.target.value))}
                            />
                        </label>
                        <label>
                            Min Blob Size: {minBlobSize}px
                            <input
                                type="range"
                                min="100"
                                max="2000"
                                step="100"
                                value={minBlobSize}
                                onChange={(e) => setMinBlobSize(Number(e.target.value))}
                            />
                        </label>
                    </>
                )}

                <label>
                    Line Distance: {config.maxLineDistance}px
                    <input
                        type="range"
                        min="50"
                        max="500"
                        step="25"
                        value={config.maxLineDistance}
                        onChange={(e) =>
                            setConfig((c) => ({ ...c, maxLineDistance: Number(e.target.value) }))
                        }
                    />
                </label>
            </div>

            {/* Video container */}
            <div className="video-container">
                <video
                    ref={videoRef}
                    src={videoSrc}
                    onLoadedMetadata={handleVideoLoaded}
                    onEnded={handleVideoEnded}
                    playsInline
                    muted
                />
                <canvas ref={canvasRef} className="overlay-canvas" />
            </div>

            <style jsx>{`
        .video-tracker {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background: rgba(0, 0, 0, 0.8);
          border-radius: 12px;
          max-width: 900px;
          margin: 0 auto;
        }

        .status-bar {
          min-height: 24px;
        }

        .status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .status.loading {
          color: #fbbf24;
        }

        .status.error {
          color: #ef4444;
        }

        .status.ready {
          color: #10b981;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .controls {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .file-input input {
          display: none;
        }

        .file-button,
        .play-button {
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: opacity 0.2s, transform 0.2s;
        }

        .file-button:hover,
        .play-button:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .play-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mode-toggle {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .mode-label {
          font-size: 0.875rem;
          color: #9ca3af;
        }

        .mode-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .mode-btn {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          color: #9ca3af;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .mode-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }

        .mode-btn.active {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          color: white;
          border-color: transparent;
        }

        .settings {
          display: flex;
          gap: 2rem;
          flex-wrap: wrap;
        }

        .settings label {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #9ca3af;
        }

        .settings input[type="range"] {
          width: 150px;
          accent-color: #8b5cf6;
        }

        .video-container {
          position: relative;
          background: #000;
          border-radius: 8px;
          overflow: hidden;
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .video-container video {
          width: 100%;
          height: auto;
          display: block;
        }

        .overlay-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
      `}</style>
        </div>
    );
}
