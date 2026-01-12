/**
 * Canvas Renderer for Tracking Visualization
 *
 * Draws bounding boxes, labels, and constellation lines on a canvas overlay
 */

import type { Track, RendererConfig, BoundingBox } from "./types";
import { DEFAULT_RENDERER_CONFIG } from "./types";

/**
 * Calculate distance between two bounding box centers
 */
function getDistance(box1: BoundingBox, box2: BoundingBox): number {
    const c1 = { x: box1.x + box1.width / 2, y: box1.y + box1.height / 2 };
    const c2 = { x: box2.x + box2.width / 2, y: box2.y + box2.height / 2 };
    return Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2);
}

/**
 * Canvas Renderer class
 */
export class CanvasRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private config: RendererConfig;

    constructor(canvas: HTMLCanvasElement, config: Partial<RendererConfig> = {}) {
        this.canvas = canvas;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get 2D context");
        this.ctx = ctx;
        this.config = { ...DEFAULT_RENDERER_CONFIG, ...config };
    }

    /**
     * Clear the canvas
     */
    clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draw all tracks with boxes, labels, and constellation lines
     */
    render(tracks: Track[], maxLineDistance: number): void {
        this.clear();

        // Draw constellation lines first (behind boxes)
        if (this.config.showLines) {
            this.drawConstellationLines(tracks, maxLineDistance);
        }

        // Draw bounding boxes and labels
        for (const track of tracks) {
            this.drawBoundingBox(track);
            this.drawLabel(track);
        }
    }

    /**
     * Draw constellation lines connecting nearby tracks
     */
    private drawConstellationLines(tracks: Track[], maxDistance: number): void {
        this.ctx.strokeStyle = this.config.lineColor;
        this.ctx.lineWidth = this.config.lineWidth;

        for (let i = 0; i < tracks.length; i++) {
            for (let j = i + 1; j < tracks.length; j++) {
                const distance = getDistance(tracks[i].bbox, tracks[j].bbox);
                if (distance < maxDistance) {
                    const c1 = {
                        x: tracks[i].bbox.x + tracks[i].bbox.width / 2,
                        y: tracks[i].bbox.y + tracks[i].bbox.height / 2,
                    };
                    const c2 = {
                        x: tracks[j].bbox.x + tracks[j].bbox.width / 2,
                        y: tracks[j].bbox.y + tracks[j].bbox.height / 2,
                    };

                    // Fade line based on distance
                    const alpha = 1 - distance / maxDistance;
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;

                    this.ctx.beginPath();
                    this.ctx.moveTo(c1.x, c1.y);
                    this.ctx.lineTo(c2.x, c2.y);
                    this.ctx.stroke();
                }
            }
        }
    }

    /**
     * Draw bounding box for a track
     */
    private drawBoundingBox(track: Track): void {
        const { x, y, width, height } = track.bbox;

        this.ctx.strokeStyle = this.config.boxColor;
        this.ctx.lineWidth = this.config.boxWidth;
        this.ctx.strokeRect(x, y, width, height);

        // Draw small corner accents for a more techy look
        const cornerSize = Math.min(10, width * 0.15, height * 0.15);
        this.ctx.lineWidth = this.config.boxWidth + 1;

        // Top-left
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + cornerSize);
        this.ctx.lineTo(x, y);
        this.ctx.lineTo(x + cornerSize, y);
        this.ctx.stroke();

        // Top-right
        this.ctx.beginPath();
        this.ctx.moveTo(x + width - cornerSize, y);
        this.ctx.lineTo(x + width, y);
        this.ctx.lineTo(x + width, y + cornerSize);
        this.ctx.stroke();

        // Bottom-left
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + height - cornerSize);
        this.ctx.lineTo(x, y + height);
        this.ctx.lineTo(x + cornerSize, y + height);
        this.ctx.stroke();

        // Bottom-right
        this.ctx.beginPath();
        this.ctx.moveTo(x + width - cornerSize, y + height);
        this.ctx.lineTo(x + width, y + height);
        this.ctx.lineTo(x + width, y + height - cornerSize);
        this.ctx.stroke();
    }

    /**
     * Draw label with ID and/or score
     */
    private drawLabel(track: Track): void {
        const { x, y } = track.bbox;
        let label = "";

        if (this.config.showIds) {
            label += `ID: ${track.id}`;
        }
        if (this.config.showScores) {
            if (label) label += " | ";
            label += track.score.toFixed(2);
        }

        if (!label) return;

        this.ctx.font = this.config.labelFont;
        const textMetrics = this.ctx.measureText(label);
        const padding = 4;
        const textHeight = 14;

        // Background for label
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.fillRect(
            x - 1,
            y - textHeight - padding * 2,
            textMetrics.width + padding * 2,
            textHeight + padding
        );

        // Text
        this.ctx.fillStyle = this.config.boxColor;
        this.ctx.fillText(label, x + padding - 1, y - padding - 2);
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<RendererConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Resize canvas to match video dimensions
     */
    resize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
    }
}
