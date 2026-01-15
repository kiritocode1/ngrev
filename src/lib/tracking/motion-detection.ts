/**
 * Motion Detection using Frame Differencing
 *
 * Detects actually moving objects by comparing consecutive frames
 * Only objects that are actively changing between frames are detected
 */

import type { BoundingBox, Detection } from "./types";

interface MotionBlob {
  bbox: BoundingBox;
  area: number;
  centerX: number;
  centerY: number;
  framesSeen: number;
  lastSeen: number;
}

/**
 * Motion Detector class
 * Uses frame-to-frame differencing to detect actual movement
 */
export class MotionDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private previousFrame: ImageData | null = null;
  private frameCount = 0;

  // Tracked motion blobs for temporal consistency
  private activeBlobs: Map<string, MotionBlob> = new Map();
  private blobIdCounter = 0;

  // Configuration
  private threshold: number;
  private minBlobArea: number;
  private minFramesSeen: number; // Require blob to be seen across multiple frames
  private maxBlobAge: number; // Remove blobs not seen recently

  constructor(
    options: {
      threshold?: number;
      minBlobArea?: number;
      minFramesSeen?: number;
      maxBlobAge?: number;
    } = {},
  ) {
    this.threshold = options.threshold ?? 25;
    this.minBlobArea = options.minBlobArea ?? 500;
    this.minFramesSeen = options.minFramesSeen ?? 2; // Must be seen in 2+ frames
    this.maxBlobAge = options.maxBlobAge ?? 5; // Remove after 5 frames unseen

    // Create offscreen canvas for processing
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Failed to get 2D context");
    this.ctx = ctx;
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

    // Resize canvas if needed
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.previousFrame = null;
      this.activeBlobs.clear();
    }

    // Draw current frame
    this.ctx.drawImage(input, 0, 0);
    const currentFrame = this.ctx.getImageData(0, 0, width, height);

    // Need at least one previous frame
    if (!this.previousFrame) {
      this.previousFrame = currentFrame;
      this.frameCount = 1;
      return [];
    }

    // Get motion mask by comparing with previous frame
    const motionMask = this.getMotionMask(currentFrame, this.previousFrame);

    // Apply morphological operations to clean up noise
    const cleanedMask = this.morphologicalClean(motionMask, width, height);

    // Find connected blobs
    const rawBlobs = this.findBlobs(cleanedMask, width, height);

    // Update blob tracking for temporal consistency
    this.updateBlobTracking(rawBlobs);

    // Only return blobs that have been seen consistently
    const confirmedDetections = this.getConfirmedDetections();

    // Store current frame for next comparison
    this.previousFrame = currentFrame;
    this.frameCount++;

    return confirmedDetections;
  }

  /**
   * Get motion mask by comparing current frame with previous frame
   * This finds pixels that have actually changed (moved)
   */
  private getMotionMask(
    currentFrame: ImageData,
    previousFrame: ImageData
  ): Uint8Array {
    const data = currentFrame.data;
    const prevData = previousFrame.data;
    const width = currentFrame.width;
    const height = currentFrame.height;
    const mask = new Uint8Array(width * height);

    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;

      // Calculate difference between current and previous frame
      const diffR = Math.abs(data[i] - prevData[i]);
      const diffG = Math.abs(data[i + 1] - prevData[i + 1]);
      const diffB = Math.abs(data[i + 2] - prevData[i + 2]);

      // Use maximum difference across channels for better sensitivity
      const maxDiff = Math.max(diffR, diffG, diffB);

      mask[pixelIndex] = maxDiff > this.threshold ? 1 : 0;
    }

    return mask;
  }

  /**
   * Morphological cleaning to reduce noise (erosion + dilation)
   */
  private morphologicalClean(
    mask: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    // First pass: erosion to remove small noise
    const eroded = new Uint8Array(mask.length);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        let count = 0;
        // 3x3 neighborhood
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nidx = (y + dy) * width + (x + dx);
            count += mask[nidx];
          }
        }
        // Require at least 5 neighbors (more strict erosion)
        eroded[idx] = count >= 5 ? 1 : 0;
      }
    }

    // Second pass: dilation to restore blob size
    const dilated = new Uint8Array(mask.length);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (eroded[idx] === 1) {
          // Dilate: set all neighbors
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nidx = (y + dy) * width + (x + dx);
              dilated[nidx] = 1;
            }
          }
        }
      }
    }

    return dilated;
  }

  /**
   * Find connected blobs in the motion mask
   */
  private findBlobs(
    mask: Uint8Array,
    width: number,
    height: number,
  ): MotionBlob[] {
    const visited = new Uint8Array(mask.length);
    const blobs: MotionBlob[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (mask[idx] === 1 && visited[idx] === 0) {
          const result = this.floodFill(mask, visited, x, y, width, height);

          if (result.area >= this.minBlobArea) {
            const bbox: BoundingBox = {
              x: result.minX,
              y: result.minY,
              width: result.maxX - result.minX,
              height: result.maxY - result.minY,
            };

            blobs.push({
              bbox,
              area: result.area,
              centerX: result.minX + (result.maxX - result.minX) / 2,
              centerY: result.minY + (result.maxY - result.minY) / 2,
              framesSeen: 1,
              lastSeen: this.frameCount,
            });
          }
        }
      }
    }

    return blobs;
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
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;
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
   * Update blob tracking for temporal consistency
   * Match new blobs to existing tracked blobs
   */
  private updateBlobTracking(newBlobs: MotionBlob[]): void {
    const matchedIds = new Set<string>();

    for (const newBlob of newBlobs) {
      let bestMatch: string | null = null;
      let bestDistance = Infinity;

      // Find closest existing blob
      for (const [id, existingBlob] of this.activeBlobs) {
        const dx = newBlob.centerX - existingBlob.centerX;
        const dy = newBlob.centerY - existingBlob.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only match if reasonably close (within half the blob size)
        const maxDistance = Math.max(existingBlob.bbox.width, existingBlob.bbox.height);
        if (distance < maxDistance && distance < bestDistance) {
          bestDistance = distance;
          bestMatch = id;
        }
      }

      if (bestMatch) {
        // Update existing blob
        const existing = this.activeBlobs.get(bestMatch)!;
        existing.bbox = newBlob.bbox;
        existing.centerX = newBlob.centerX;
        existing.centerY = newBlob.centerY;
        existing.area = newBlob.area;
        existing.framesSeen++;
        existing.lastSeen = this.frameCount;
        matchedIds.add(bestMatch);
      } else {
        // Create new tracked blob
        const id = `blob_${this.blobIdCounter++}`;
        this.activeBlobs.set(id, {
          ...newBlob,
          lastSeen: this.frameCount,
        });
        matchedIds.add(id);
      }
    }

    // Remove old blobs that haven't been seen recently
    for (const [id, blob] of this.activeBlobs) {
      const age = this.frameCount - blob.lastSeen;
      if (age > this.maxBlobAge) {
        this.activeBlobs.delete(id);
      }
    }
  }

  /**
   * Get detections that have been confirmed across multiple frames
   */
  private getConfirmedDetections(): Detection[] {
    const detections: Detection[] = [];

    for (const [, blob] of this.activeBlobs) {
      // Only include blobs seen across enough frames
      if (blob.framesSeen >= this.minFramesSeen) {
        // Score based on blob consistency and size
        const sizeScore = Math.min(1, blob.area / 10000);
        const consistencyScore = Math.min(1, blob.framesSeen / 10);
        const score = (sizeScore + consistencyScore) / 2;

        detections.push({
          bbox: blob.bbox,
          class: "motion",
          score,
        });
      }
    }

    return detections;
  }

  /**
   * Reset the motion detector
   */
  reset(): void {
    this.previousFrame = null;
    this.activeBlobs.clear();
    this.frameCount = 0;
  }

  /**
   * Update configuration
   */
  setConfig(options: {
    threshold?: number;
    minBlobArea?: number;
    minFramesSeen?: number;
    maxBlobAge?: number;
  }): void {
    if (options.threshold !== undefined) this.threshold = options.threshold;
    if (options.minBlobArea !== undefined) this.minBlobArea = options.minBlobArea;
    if (options.minFramesSeen !== undefined) this.minFramesSeen = options.minFramesSeen;
    if (options.maxBlobAge !== undefined) this.maxBlobAge = options.maxBlobAge;
  }
}
