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
        this.ctx.lineWidth = this.config.lineWidth;

        for (let i = 0; i < tracks.length; i++) {
            const trackA = tracks[i];
            // Use the center of the detection for the line start
            const centerA = {
                x: trackA.bbox.x + trackA.bbox.width / 2,
                y: trackA.bbox.y + trackA.bbox.height / 2,
            };

            for (let j = i + 1; j < tracks.length; j++) {
                const trackB = tracks[j];
                const distance = getDistance(trackA.bbox, trackB.bbox);

                if (distance < maxDistance) {
                    const centerB = {
                        x: trackB.bbox.x + trackB.bbox.width / 2,
                        y: trackB.bbox.y + trackB.bbox.height / 2,
                    };

                    // Alpha based on distance (closer = more opaque)
                    const opacity = Math.max(0.1, 1 - (distance / maxDistance));

                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
                    this.ctx.beginPath();
                    this.ctx.moveTo(centerA.x, centerA.y);
                    this.ctx.lineTo(centerB.x, centerB.y);
                    this.ctx.stroke();
                }
            }
        }
    }

    /**
     * Draw small marker box for a track
     */
    private drawBoundingBox(track: Track): void {
        const { x, y, width, height } = track.bbox;

        // Calculate center
        const cx = x + width / 2;
        const cy = y + height / 2;

        // Fixed small size for the marker
        const size = 12;
        const halfSize = size / 2;

        this.ctx.strokeStyle = this.config.boxColor;
        this.ctx.lineWidth = this.config.boxWidth;

        // Draw small square at center
        this.ctx.strokeRect(cx - halfSize, cy - halfSize, size, size);

        // Add a small fill for visibility
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        this.ctx.fillRect(cx - halfSize, cy - halfSize, size, size);
    }

    /**
     * Draw label with ID and/or score
     */
    private drawLabel(track: Track): void {
        const { x, y, width, height } = track.bbox;
        const cx = x + width / 2;
        const cy = y + height / 2;
        const size = 12; // Match box size

        let label = "";

        if (this.config.showIds) {
            label += `${track.id}`;
        }

        // Only show score if it's very high or requested specifically
        // if (this.config.showScores) {
        //     label += ` ${track.score.toFixed(2)}`;
        // }

        if (!label) return;

        this.ctx.font = this.config.labelFont;
        this.ctx.fillStyle = "#ffffff";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "bottom";

        // Draw label just above the marker
        this.ctx.fillText(label, cx, cy - size / 2 - 2);
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
