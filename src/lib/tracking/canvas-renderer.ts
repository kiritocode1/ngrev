/**
 * Canvas Renderer for Tracking Visualization
 *
 * Draws bounding boxes, labels, and constellation lines on a canvas overlay
 * Renders at native device pixel ratio for sharp 4K quality
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
 * Supports high-DPI rendering for crisp 4K quality
 */
export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: RendererConfig;
  private dpr: number = 1;
  private logicalWidth: number = 0;
  private logicalHeight: number = 0;

  constructor(canvas: HTMLCanvasElement, config: Partial<RendererConfig> = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true, // Performance optimization
    });
    if (!ctx) throw new Error("Failed to get 2D context");
    this.ctx = ctx;
    this.config = { ...DEFAULT_RENDERER_CONFIG, ...config };

    // Get device pixel ratio for sharp rendering
    this.dpr = Math.min(window.devicePixelRatio || 1, 3); // Cap at 3x for performance
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw all tracks with boxes, labels, and constellation lines
   * Supports beat-gating via globalOpacity and track limiting
   */
  render(tracks: Track[], maxLineDistance: number): void {
    this.clear();

    // Skip rendering if fully transparent (for beat-gating)
    if (this.config.globalOpacity <= 0) return;

    // Limit tracks if configured (prioritize by score/confidence)
    let displayTracks = tracks;
    if (this.config.maxDisplayTracks > 0 && tracks.length > this.config.maxDisplayTracks) {
      // Sort by score descending and take top N
      displayTracks = [...tracks]
        .sort((a, b) => b.score - a.score)
        .slice(0, this.config.maxDisplayTracks);
    }

    // Save context and apply DPR scaling
    this.ctx.save();
    this.ctx.scale(this.dpr, this.dpr);

    // Apply global opacity for beat-gating effect
    this.ctx.globalAlpha = this.config.globalOpacity;

    // Enable crisp rendering for shapes
    this.ctx.imageSmoothingEnabled = false;
    // @ts-expect-error - vendor prefix for older browsers
    this.ctx.mozImageSmoothingEnabled = false;
    // @ts-expect-error - vendor prefix for older browsers  
    this.ctx.webkitImageSmoothingEnabled = false;

    // Draw constellation lines first (behind boxes)
    if (this.config.showLines) {
      this.drawConstellationLines(displayTracks, maxLineDistance);
    }

    // Draw bounding boxes and labels
    for (const track of displayTracks) {
      this.drawBoundingBox(track);
      this.drawLabel(track);
    }

    this.ctx.restore();
  }

  /**
   * Draw constellation lines using K-Nearest Neighbors (KNN) approach
   * Each track connects only to its K nearest neighbors, creating an elegant
   * network topology instead of a spider web
   */
  private drawConstellationLines(tracks: Track[], maxDistance: number): void {
    if (this.config.lineWidth <= 0 || tracks.length < 2) return;

    // Scale line width for DPR - ensure minimum 1 device pixel
    const lineWidth = Math.max(this.config.lineWidth, 1 / this.dpr);
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Maximum neighbors per node (K in KNN)
    const maxNeighbors = 3;

    // Track which connections we've already drawn to avoid duplicates
    const drawnConnections = new Set<string>();

    // Pre-calculate centers for all tracks
    const centers = tracks.map((track) => ({
      x: track.bbox.x + track.bbox.width / 2,
      y: track.bbox.y + track.bbox.height / 2,
    }));

    // For each track, find and connect to its K nearest neighbors
    for (let i = 0; i < tracks.length; i++) {
      const trackA = tracks[i];
      const centerA = centers[i];

      // Calculate distances to all other tracks
      const distances: { index: number; distance: number }[] = [];

      for (let j = 0; j < tracks.length; j++) {
        if (i === j) continue;

        const distance = getDistance(trackA.bbox, tracks[j].bbox);

        // Only consider tracks within maxDistance
        if (distance < maxDistance) {
          distances.push({ index: j, distance });
        }
      }

      // Sort by distance and take K nearest
      distances.sort((a, b) => a.distance - b.distance);
      const nearestNeighbors = distances.slice(0, maxNeighbors);

      // Draw lines to nearest neighbors
      for (const neighbor of nearestNeighbors) {
        // Create a unique key for this connection (smaller index first)
        const connKey = i < neighbor.index
          ? `${i}-${neighbor.index}`
          : `${neighbor.index}-${i}`;

        // Skip if already drawn
        if (drawnConnections.has(connKey)) continue;
        drawnConnections.add(connKey);

        const centerB = centers[neighbor.index];

        // Opacity based on distance - closer = more visible
        const opacity = Math.max(0.15, 1 - neighbor.distance / maxDistance);

        this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.6})`;
        this.ctx.beginPath();
        this.ctx.moveTo(Math.round(centerA.x) + 0.5, Math.round(centerA.y) + 0.5);
        this.ctx.lineTo(Math.round(centerB.x) + 0.5, Math.round(centerB.y) + 0.5);
        this.ctx.stroke();
      }
    }
  }

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

    // Round coordinates for crisp rendering
    x = Math.round(x) + 0.5;
    y = Math.round(y) + 0.5;
    width = Math.round(width);
    height = Math.round(height);

    this.ctx.strokeStyle = this.config.boxColor;
    // Scale line width for DPR - ensure minimum 1 device pixel for crisp lines
    const boxLineWidth = Math.max(this.config.boxWidth, 1 / this.dpr);
    this.ctx.lineWidth = boxLineWidth;
    this.ctx.lineCap = "square";
    this.ctx.lineJoin = "miter";
    this.ctx.setLineDash([]);

    switch (style) {
      case "basic":
        if (this.config.boxWidth > 0) {
          this.ctx.strokeRect(x, y, width, height);
        }
        this.ctx.fillStyle = this.config.boxColor + "20";
        this.ctx.fillRect(x, y, width, height);
        break;

      case "frame":
        if (this.config.boxWidth > 0) {
          this.ctx.strokeRect(x, y, width, height);
        }
        break;

      case "dash":
        if (this.config.boxWidth > 0) {
          this.ctx.setLineDash([6, 3]);
          this.ctx.strokeRect(x, y, width, height);
          this.ctx.setLineDash([]);
        }
        break;

      case "corner-l":
        this.drawCorners(x, y, width, height);
        break;

      case "grid":
        if (this.config.boxWidth > 0) this.ctx.strokeRect(x, y, width, height);
        this.drawGridLines(x, y, width, height);
        break;

      case "scope":
        this.drawScope(x - 0.5, y - 0.5, width, height);
        break;
    }
  }

  private drawCorners(x: number, y: number, w: number, h: number): void {
    const len = Math.min(w, h) * 0.25;
    this.ctx.lineWidth = this.config.boxWidth;
    this.ctx.lineCap = "square";
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
    this.ctx.moveTo(Math.round(x + w / 3) + 0.5, y);
    this.ctx.lineTo(Math.round(x + w / 3) + 0.5, y + h);
    this.ctx.moveTo(Math.round(x + (2 * w) / 3) + 0.5, y);
    this.ctx.lineTo(Math.round(x + (2 * w) / 3) + 0.5, y + h);

    this.ctx.moveTo(x, Math.round(y + h / 3) + 0.5);
    this.ctx.lineTo(x + w, Math.round(y + h / 3) + 0.5);
    this.ctx.moveTo(x, Math.round(y + (2 * h) / 3) + 0.5);
    this.ctx.lineTo(x + w, Math.round(y + (2 * h) / 3) + 0.5);

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
    this.ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Draw label with ID and/or score
   */
  private drawLabel(track: Track): void {
    if (!this.config.showLabels) return;

    let { x, y, width, height } = track.bbox;

    // Apply fixed box size if configured
    if (this.config.fixedBoxSize > 0) {
      const fixed = this.config.fixedBoxSize;
      const cxRaw = x + width / 2;
      const cyRaw = y + height / 2;
      x = cxRaw - fixed / 2;
      y = cyRaw - fixed / 2;
      width = fixed;
      height = fixed;
    }

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

    // Use configurable font size - round to whole pixels for crisp text
    const fontSize = Math.round(this.config.fontSize || 10);

    // Use monospace for all sizes - crisper on canvas
    const fontFamily = '"SF Mono", "Monaco", "Consolas", monospace';

    // Use whole-pixel font weight
    const fontWeight = 500;

    this.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    this.ctx.fillStyle = "#ffffff";
    this.ctx.textAlign = "center";

    const pos = this.config.textPosition || "top";

    // Draw text outline for contrast (no blur - crisp edges)
    this.ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    this.ctx.lineWidth = Math.max(2, fontSize / 5);
    this.ctx.lineJoin = "round";
    this.ctx.miterLimit = 2;

    if (pos === "center") {
      this.ctx.textBaseline = "middle";
      // Stroke first for outline
      this.ctx.strokeText(label, Math.round(cx), Math.round(cy));
      // Then fill
      this.ctx.fillText(label, Math.round(cx), Math.round(cy));
      return;
    }

    this.ctx.textBaseline = pos === "top" ? "bottom" : "top";
    const offset = Math.round(fontSize / 2);

    const textX = Math.round(cx);
    const textY = pos === "top"
      ? Math.round(y) - offset
      : Math.round(y + height) + offset + fontSize;

    // Stroke first for outline, then fill
    this.ctx.strokeText(label, textX, textY);
    this.ctx.fillText(label, textX, textY);
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<RendererConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Resize canvas to match video dimensions with high-DPI support
   * This is crucial for 4K quality rendering
   * Note: CSS display size is controlled by Tailwind classes (w-full h-full)
   */
  resize(width: number, height: number): void {
    // Update DPR in case it changed
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);

    this.logicalWidth = width;
    this.logicalHeight = height;

    // Set actual canvas buffer size to native resolution for crisp rendering
    // Display size is handled by CSS classes (w-full h-full object-contain)
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);

    // Configure context for sharp rendering
    this.ctx.imageSmoothingEnabled = false;
  }
}
