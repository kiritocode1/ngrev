/**
 * Canvas Renderer for Tracking Visualization
 *
 * Draws bounding boxes, labels, and constellation lines on a canvas overlay
 */

import type { BoundingBox, RendererConfig, Track } from "./types";
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
          const opacity = Math.max(0.1, 1 - distance / maxDistance);

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
   * Draw bounding box or marker for a track
   */
  /**
   * Draw bounding box or marker for a track based on style
   */
  private drawBoundingBox(track: Track): void {
    let { x, y, width, height } = track.bbox;
    const style = this.config.boxStyle;

    // Apply fixed box size if configured
    if (this.config.fixedBoxSize > 0) {
      const fixed = this.config.fixedBoxSize;
      const cx = x + width / 2;
      const cy = y + height / 2;
      x = cx - fixed / 2;
      y = cy - fixed / 2;
      width = fixed;
      height = fixed;
    }

    if (style === "none") return;

    this.ctx.strokeStyle = this.config.boxColor;
    this.ctx.lineWidth = this.config.boxWidth;
    this.ctx.setLineDash([]); // Reset dash

    switch (style) {
      case "basic":
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.fillStyle = this.config.boxColor + "20"; // 12% opacity
        this.ctx.fillRect(x, y, width, height);
        break;

      case "frame":
        this.ctx.strokeRect(x, y, width, height);
        // Frame implies no fill, maybe slightly thicker or distinct
        break;

      case "dash":
        this.ctx.setLineDash([4, 4]);
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.setLineDash([]);
        break;

      case "corner-l":
        this.drawCorners(x, y, width, height);
        break;

      case "grid":
        this.ctx.strokeRect(x, y, width, height);
        this.drawGridLines(x, y, width, height);
        break;

      case "scope":
        this.drawScope(x, y, width, height);
        break;
    }
  }

  private drawCorners(x: number, y: number, w: number, h: number): void {
    const len = Math.min(w, h) * 0.25;
    this.ctx.beginPath();

    // Top-left
    this.ctx.moveTo(x, y + len);
    this.ctx.lineTo(x, y);
    this.ctx.lineTo(x + len, y);

    // Top-right
    this.ctx.moveTo(x + w - len, y);
    this.ctx.lineTo(x + w, y);
    this.ctx.lineTo(x + w, y + len);

    // Bottom-right
    this.ctx.moveTo(x + w, y + h - len);
    this.ctx.lineTo(x + w, y + h);
    this.ctx.lineTo(x + w - len, y + h);

    // Bottom-left
    this.ctx.moveTo(x + len, y + h);
    this.ctx.lineTo(x, y + h);
    this.ctx.lineTo(x, y + h - len);

    this.ctx.stroke();
  }

  private drawGridLines(x: number, y: number, w: number, h: number): void {
    this.ctx.beginPath();
    // Verticals
    this.ctx.moveTo(x + w / 3, y);
    this.ctx.lineTo(x + w / 3, y + h);
    this.ctx.moveTo(x + (2 * w) / 3, y);
    this.ctx.lineTo(x + (2 * w) / 3, y + h);

    // Horizontals
    this.ctx.moveTo(x, y + h / 3);
    this.ctx.lineTo(x + w, y + h / 3);
    this.ctx.moveTo(x, y + (2 * h) / 3);
    this.ctx.lineTo(x + w, y + (2 * h) / 3);

    this.ctx.globalAlpha = 0.5;
    this.ctx.stroke();
    this.ctx.globalAlpha = 1.0;
  }

  private drawScope(x: number, y: number, w: number, h: number): void {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const radius = Math.min(w, h) / 2;

    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.stroke();

    // Crosshairs
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - radius - 5);
    this.ctx.lineTo(cx, cy + radius + 5);
    this.ctx.moveTo(cx - radius - 5, cy);
    this.ctx.lineTo(cx + radius + 5, cy);
    this.ctx.globalAlpha = 0.7;
    this.ctx.stroke();
    this.ctx.globalAlpha = 1.0;

    // Center point
    this.ctx.fillStyle = this.config.boxColor;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Draw label with ID and/or score
   */
  private drawLabel(track: Track): void {
    if (!this.config.showLabels) return;

    let { x, y, width, height } = track.bbox;

    // Apply fixed box size if configured to align label correctly
    if (this.config.fixedBoxSize > 0) {
      const fixed = this.config.fixedBoxSize;
      const cxRaw = x + width / 2;
      const cyRaw = y + height / 2;
      x = cxRaw - fixed / 2;
      y = cyRaw - fixed / 2;
      width = fixed;
      height = fixed;
    }

    // Position depends on box mode
    const cx = x + width / 2;
    const cy = y + height / 2;

    let label = "";

    if (this.config.showIds) {
      label += `${track.id}`;
    }

    if (this.config.showScores) {
      label += ` ${(track.score * 100).toFixed(0)}%`;
    }

    if (!label) return;

    this.ctx.font = this.config.labelFont;
    this.ctx.fillStyle = "#ffffff";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "bottom";

    // If full box/frame style, draw label on top edge
    if (this.config.boxStyle !== "none" && this.config.boxStyle !== "scope") {
      this.ctx.fillText(label, cx, y - 4);
    } else {
      // If none or scope (center oriented), draw near center
      const size = 12;
      this.ctx.fillText(label, cx, cy - size / 2 - 2 + (this.config.boxStyle === "scope" ? -20 : 0));
    }
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
