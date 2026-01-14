/**
 * Video Exporter using mediabunny
 * 
 * This module handles video export with audio preservation, combining
 * canvas-rendered video (with tracking overlays) with the original audio track.
 */

import {
    Output,
    Mp4OutputFormat,
    WebMOutputFormat,
    BufferTarget,
    CanvasSource,
    AudioBufferSource,
    Input,
    BlobSource,
    AudioBufferSink,
    ALL_FORMATS,
    QUALITY_HIGH,
    QUALITY_MEDIUM,
} from "mediabunny";

export interface ExportConfig {
    /** Target frame rate (default: 30) */
    frameRate?: number;
    /** Video bitrate in bps (default: 4Mbps) */
    videoBitrate?: number;
    /** Audio bitrate in bps (default: 128kbps) */
    audioBitrate?: number;
    /** Output format: 'mp4' or 'webm' (default: 'mp4') */
    format?: "mp4" | "webm";
    /** Video codec: 'avc' for H.264 or 'av1' (default: 'avc') */
    videoCodec?: "avc" | "av1";
    /** Audio codec: 'aac' or 'opus' (default depends on format) */
    audioCodec?: "aac" | "opus";
}

export interface ExportProgress {
    phase: "preparing" | "extracting-audio" | "recording" | "finalizing" | "complete" | "error";
    progress: number; // 0-100
    currentFrame?: number;
    totalFrames?: number;
    message?: string;
}

export type ProgressCallback = (progress: ExportProgress) => void;

/**
 * ExportSession manages the recording of canvas frames with audio
 */
export class ExportSession {
    private output: Output | null = null;
    private videoSource: CanvasSource | null = null;
    private audioSource: AudioBufferSource | null = null;
    private isRecording = false;
    private frameCount = 0;
    private startTime = 0;
    private config: Required<ExportConfig>;
    private audioBuffers: AudioBuffer[] = [];
    private progressCallback?: ProgressCallback;

    constructor(config: ExportConfig = {}) {
        this.config = {
            frameRate: config.frameRate ?? 30,
            videoBitrate: config.videoBitrate ?? 4_000_000,
            audioBitrate: config.audioBitrate ?? 128_000,
            format: config.format ?? "mp4",
            videoCodec: config.videoCodec ?? "avc",
            audioCodec: config.audioCodec ?? (config.format === "webm" ? "opus" : "aac"),
        };
    }

    /**
     * Extract audio buffers from a video file for later export
     */
    async extractAudioFromVideo(
        videoFile: File | Blob,
        onProgress?: ProgressCallback
    ): Promise<AudioBuffer[]> {
        this.progressCallback = onProgress;
        this.reportProgress("extracting-audio", 0, "Reading audio from video...");

        try {
            const input = new Input({
                source: new BlobSource(videoFile),
                formats: ALL_FORMATS,
            });

            const audioTrack = await input.getPrimaryAudioTrack();
            if (!audioTrack) {
                console.warn("No audio track found in video");
                this.reportProgress("extracting-audio", 100, "No audio track found");
                return [];
            }

            const duration = await audioTrack.computeDuration();
            const sink = new AudioBufferSink(audioTrack);
            const buffers: AudioBuffer[] = [];

            let processedTime = 0;
            for await (const { buffer, timestamp } of sink.buffers()) {
                buffers.push(buffer);
                processedTime = timestamp + buffer.duration;
                const progress = Math.min(99, (processedTime / duration) * 100);
                this.reportProgress("extracting-audio", progress, `Extracting audio: ${Math.round(progress)}%`);
            }

            this.audioBuffers = buffers;
            this.reportProgress("extracting-audio", 100, "Audio extraction complete");
            await input.dispose();
            return buffers;
        } catch (error) {
            console.error("Failed to extract audio:", error);
            this.reportProgress("error", 0, `Audio extraction failed: ${error}`);
            return [];
        }
    }

    /**
     * Start a new recording session
     */
    async startRecording(
        canvas: HTMLCanvasElement,
        onProgress?: ProgressCallback
    ): Promise<void> {
        if (this.isRecording) {
            throw new Error("Recording already in progress");
        }

        this.progressCallback = onProgress ?? this.progressCallback;
        this.reportProgress("preparing", 0, "Initializing export...");

        try {
            const format = this.config.format === "webm"
                ? new WebMOutputFormat()
                : new Mp4OutputFormat();

            this.output = new Output({
                format,
                target: new BufferTarget(),
            });

            // Add video track from canvas
            this.videoSource = new CanvasSource(canvas, {
                codec: this.config.videoCodec,
                bitrate: this.config.videoBitrate,
            });
            this.output.addVideoTrack(this.videoSource, {
                frameRate: this.config.frameRate,
            });

            // Add audio track if we have extracted audio
            if (this.audioBuffers.length > 0) {
                this.audioSource = new AudioBufferSource({
                    codec: this.config.audioCodec,
                    bitrate: this.config.audioBitrate,
                });
                this.output.addAudioTrack(this.audioSource);
            }

            await this.output.start();
            this.isRecording = true;
            this.frameCount = 0;
            this.startTime = performance.now();

            // Add all audio buffers immediately after starting
            if (this.audioSource && this.audioBuffers.length > 0) {
                for (const buffer of this.audioBuffers) {
                    await this.audioSource.add(buffer);
                }
            }

            this.reportProgress("recording", 0, "Recording started");
        } catch (error) {
            this.reportProgress("error", 0, `Failed to start recording: ${error}`);
            throw error;
        }
    }

    /**
     * Add a frame to the recording
     */
    async addFrame(): Promise<void> {
        if (!this.isRecording || !this.videoSource) {
            return;
        }

        const frameDuration = 1 / this.config.frameRate;
        const timestamp = this.frameCount * frameDuration;

        await this.videoSource.add(timestamp, frameDuration);
        this.frameCount++;
    }

    /**
     * Stop recording and finalize the export
     */
    async stopRecording(): Promise<Blob | null> {
        if (!this.isRecording || !this.output) {
            return null;
        }

        this.reportProgress("finalizing", 0, "Finalizing video...");

        try {
            // Close sources
            if (this.videoSource) {
                await this.videoSource.close();
            }
            if (this.audioSource) {
                await this.audioSource.close();
            }

            await this.output.finalize();

            const target = this.output.target as BufferTarget;
            const mimeType = this.config.format === "webm" ? "video/webm" : "video/mp4";
            if (!target.buffer) {
                throw new Error("Export failed: no output buffer available");
            }
            const blob = new Blob([target.buffer], { type: mimeType });

            this.isRecording = false;
            this.reportProgress("complete", 100, `Export complete: ${this.frameCount} frames`);

            return blob;
        } catch (error) {
            this.reportProgress("error", 0, `Finalization failed: ${error}`);
            throw error;
        } finally {
            this.cleanup();
        }
    }

    /**
     * Cancel the current recording
     */
    async cancel(): Promise<void> {
        if (this.output) {
            await this.output.cancel();
        }
        this.cleanup();
    }

    /**
     * Get the current frame count
     */
    getFrameCount(): number {
        return this.frameCount;
    }

    /**
     * Check if currently recording
     */
    isActive(): boolean {
        return this.isRecording;
    }

    private cleanup(): void {
        this.output = null;
        this.videoSource = null;
        this.audioSource = null;
        this.isRecording = false;
        this.frameCount = 0;
    }

    private reportProgress(
        phase: ExportProgress["phase"],
        progress: number,
        message?: string
    ): void {
        if (this.progressCallback) {
            this.progressCallback({
                phase,
                progress,
                currentFrame: this.frameCount,
                message,
            });
        }
    }
}

/**
 * Helper function to download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Quick export: Record the video playback with overlays
 */
export async function exportVideoWithOverlays(
    videoElement: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    sourceFile: File | Blob,
    onProgress?: ProgressCallback,
    config?: ExportConfig
): Promise<Blob | null> {
    const session = new ExportSession(config);

    // Extract audio first
    await session.extractAudioFromVideo(sourceFile, onProgress);

    // Start recording
    await session.startRecording(canvas, onProgress);

    // Play video and capture frames
    return new Promise((resolve, reject) => {
        const frameRate = config?.frameRate ?? 30;
        const frameDuration = 1000 / frameRate;
        let lastFrameTime = 0;

        const captureFrame = async () => {
            if (videoElement.paused || videoElement.ended) {
                const blob = await session.stopRecording();
                resolve(blob);
                return;
            }

            const now = performance.now();
            if (now - lastFrameTime >= frameDuration) {
                await session.addFrame();
                lastFrameTime = now;
            }

            requestAnimationFrame(captureFrame);
        };

        videoElement.play().then(() => {
            captureFrame();
        }).catch(reject);
    });
}
