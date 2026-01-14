/**
 * Motion Detection using Background Subtraction
 *
 * Detects any moving objects by comparing frames against a background model
 */

import type { BoundingBox, Detection } from "./types";

/**
 * Motion Detector class
 * Uses frame differencing and adaptive background subtraction
 */
export class MotionDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private backgroundCanvas: HTMLCanvasElement;
  private backgroundCtx: CanvasRenderingContext2D;
  private previousFrame: ImageData | null = null;
  private backgroundModel: ImageData | null = null;
  private frameCount = 0;

  // Configuration
  private threshold: number;
  private minBlobArea: number;
  private learningRate: number;

  constructor(
    options: {
      threshold?: number;
      minBlobArea?: number;
      learningRate?: number;
    } = {},
  ) {
    this.threshold = options.threshold ?? 30;
    this.minBlobArea = options.minBlobArea ?? 500;
    this.learningRate = options.learningRate ?? 0.01;

    // Create offscreen canvases for processing
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Failed to get 2D context");
    this.ctx = ctx;

    this.backgroundCanvas = document.createElement("canvas");
    const bgCtx = this.backgroundCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!bgCtx) throw new Error("Failed to get background 2D context");
    this.backgroundCtx = bgCtx;
  }

  /**
   * Detect motion in the given video frame
   */
  detect(
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  ): Detection[] {
    const width =
      input instanceof HTMLVideoElement ? input.videoWidth : input.width;
    const height =
      input instanceof HTMLVideoElement ? input.videoHeight : input.height;

    if (width === 0 || height === 0) return [];

    // Resize canvases if needed
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.backgroundCanvas.width = width;
      this.backgroundCanvas.height = height;
      this.backgroundModel = null;
      this.previousFrame = null;
    }

    // Draw current frame
    this.ctx.drawImage(input, 0, 0);
    const currentFrame = this.ctx.getImageData(0, 0, width, height);

    // Initialize background model on first frame
    if (!this.backgroundModel) {
      this.backgroundModel = new ImageData(
        new Uint8ClampedArray(currentFrame.data),
        width,
        height,
      );
      this.previousFrame = currentFrame;
      this.frameCount = 1;
      return [];
    }

    // Update background model with running average
    this.updateBackgroundModel(currentFrame);

    // Get foreground mask (moving pixels)
    const foregroundMask = this.getForegroundMask(currentFrame);

    // Find contours/blobs in the foreground mask
    const detections = this.findBlobs(foregroundMask, width, height);

    this.previousFrame = currentFrame;
    this.frameCount++;

    return detections;
  }

  /**
   * Update background model using exponential moving average
   */
  private updateBackgroundModel(currentFrame: ImageData): void {
    if (!this.backgroundModel) return;

    const data = currentFrame.data;
    const bgData = this.backgroundModel.data;
    const lr = this.learningRate;

    for (let i = 0; i < data.length; i += 4) {
      bgData[i] = bgData[i] * (1 - lr) + data[i] * lr; // R
      bgData[i + 1] = bgData[i + 1] * (1 - lr) + data[i + 1] * lr; // G
      bgData[i + 2] = bgData[i + 2] * (1 - lr) + data[i + 2] * lr; // B
    }
  }

  /**
   * Get binary mask of moving pixels
   */
  private getForegroundMask(currentFrame: ImageData): Uint8Array {
    if (!this.backgroundModel) return new Uint8Array(0);

    const data = currentFrame.data;
    const bgData = this.backgroundModel.data;
    const width = currentFrame.width;
    const height = currentFrame.height;
    const mask = new Uint8Array(width * height);

    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;

      // Calculate color difference
      const diffR = Math.abs(data[i] - bgData[i]);
      const diffG = Math.abs(data[i + 1] - bgData[i + 1]);
      const diffB = Math.abs(data[i + 2] - bgData[i + 2]);
      const diff = (diffR + diffG + diffB) / 3;

      mask[pixelIndex] = diff > this.threshold ? 1 : 0;
    }

    // Apply simple morphological operations (erosion + dilation) to reduce noise
    return this.morphologicalClean(mask, width, height);
  }

  /**
   * Simple morphological cleaning to reduce noise
   */
  private morphologicalClean(
    mask: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const result = new Uint8Array(mask.length);

    // Erosion followed by dilation (opening)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        // 3x3 erosion - require all neighbors
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nidx = (y + dy) * width + (x + dx);
            count += mask[nidx];
          }
        }
        result[idx] = count >= 5 ? 1 : 0;
      }
    }

    return result;
  }

  /**
   * Find connected blobs in the foreground mask using simple flood fill
   */
  private findBlobs(
    mask: Uint8Array,
    width: number,
    height: number,
  ): Detection[] {
    const visited = new Uint8Array(mask.length);
    const detections: Detection[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (mask[idx] === 1 && visited[idx] === 0) {
          // Found new blob, flood fill to find extent
          const blob = this.floodFill(mask, visited, x, y, width, height);

          if (blob.area >= this.minBlobArea) {
            const bbox: BoundingBox = {
              x: blob.minX,
              y: blob.minY,
              width: blob.maxX - blob.minX,
              height: blob.maxY - blob.minY,
            };

            // Score based on blob size (larger = higher confidence)
            const score = Math.min(1, blob.area / 5000);

            detections.push({
              bbox,
              class: "motion",
              score,
            });
          }
        }
      }
    }

    return detections;
  }

  /**
   * Flood fill to find blob extent
   */
  private floodFill(
    mask: Uint8Array,
    visited: Uint8Array,
    startX: number,
    startY: number,
    width: number,
    height: number,
  ): { minX: number; minY: number; maxX: number; maxY: number; area: number } {
    const stack: [number, number][] = [[startX, startY]];
    let minX = startX,
      maxX = startX;
    let minY = startY,
      maxY = startY;
    let area = 0;

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[idx] === 1 || mask[idx] === 0) continue;

      visited[idx] = 1;
      area++;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // Add neighbors (4-connected)
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    return { minX, minY, maxX, maxY, area };
  }

  /**
   * Reset the background model
   */
  reset(): void {
    this.backgroundModel = null;
    this.previousFrame = null;
    this.frameCount = 0;
  }

  /**
   * Update configuration
   */
  setConfig(options: {
    threshold?: number;
    minBlobArea?: number;
    learningRate?: number;
  }): void {
    if (options.threshold !== undefined) this.threshold = options.threshold;
    if (options.minBlobArea !== undefined)
      this.minBlobArea = options.minBlobArea;
    if (options.learningRate !== undefined)
      this.learningRate = options.learningRate;
  }
}
