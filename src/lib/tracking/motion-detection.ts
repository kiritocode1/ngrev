/**
 * Motion Detection using Optical Flow-inspired Techniques
 *
 * Detects moving objects by tracking consistent motion patterns
 * across multiple frames, focusing on coherent moving subjects
 */

import type { BoundingBox, Detection } from "./types";

interface TrackedMotion {
  id: number;
  bbox: BoundingBox;
  centerX: number;
  centerY: number;
  velocityX: number;
  velocityY: number;
  area: number;
  framesSeen: number;
  lastSeen: number;
  confidence: number;
  trail: { x: number; y: number }[]; // Motion trail
}

/**
 * Motion Detector class
 * Tracks consistent motion patterns across frames
 */
export class MotionDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private frameBuffer: ImageData[] = [];
  private frameCount = 0;

  // Tracked motion objects for persistence
  private trackedMotions: Map<number, TrackedMotion> = new Map();
  private nextId = 1;

  // Configuration
  private threshold: number;
  private minBlobArea: number;
  private bufferSize: number;
  private mergeDistance: number;

  constructor(
    options: {
      threshold?: number;
      minBlobArea?: number;
      bufferSize?: number;
      mergeDistance?: number;
    } = {},
  ) {
    // Higher threshold to filter out noise
    this.threshold = options.threshold ?? 30;
    // Larger minimum area for coherent objects
    this.minBlobArea = options.minBlobArea ?? 200;
    // Number of frames to buffer for motion analysis
    this.bufferSize = options.bufferSize ?? 3;
    // Distance to merge nearby detections
    this.mergeDistance = options.mergeDistance ?? 50;

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
      this.frameBuffer = [];
      this.trackedMotions.clear();
    }

    // Draw current frame
    this.ctx.drawImage(input, 0, 0);
    const currentFrame = this.ctx.getImageData(0, 0, width, height);

    // Add to buffer
    this.frameBuffer.push(currentFrame);
    if (this.frameBuffer.length > this.bufferSize) {
      this.frameBuffer.shift();
    }

    // Need at least 2 frames
    if (this.frameBuffer.length < 2) {
      this.frameCount++;
      return [];
    }

    // Get accumulated motion mask from frame buffer
    const motionMask = this.getAccumulatedMotionMask(width, height);

    // Apply aggressive morphological cleaning
    const cleanedMask = this.morphologicalClean(motionMask, width, height);

    // Find connected motion regions
    const rawRegions = this.findMotionRegions(cleanedMask, width, height);

    // Merge nearby regions into coherent objects
    const mergedRegions = this.mergeNearbyRegions(rawRegions);

    // Update tracked motions with new regions
    this.updateTrackedMotions(mergedRegions);

    // Get confirmed detections
    const detections = this.getConfirmedDetections();

    this.frameCount++;
    return detections;
  }

  /**
   * Get motion mask accumulated across the frame buffer
   * This helps track persistent motion and filter transient noise
   */
  private getAccumulatedMotionMask(width: number, height: number): Uint8Array {
    const mask = new Uint8Array(width * height);
    const frames = this.frameBuffer;

    // Compare each pair of consecutive frames
    for (let f = 1; f < frames.length; f++) {
      const current = frames[f].data;
      const previous = frames[f - 1].data;

      for (let i = 0; i < current.length; i += 4) {
        const pixelIndex = i / 4;

        // Calculate color difference
        const diffR = Math.abs(current[i] - previous[i]);
        const diffG = Math.abs(current[i + 1] - previous[i + 1]);
        const diffB = Math.abs(current[i + 2] - previous[i + 2]);

        // Use luminance-weighted difference for better accuracy
        const diff = diffR * 0.299 + diffG * 0.587 + diffB * 0.114;

        if (diff > this.threshold) {
          mask[pixelIndex]++;
        }
      }
    }

    // Require motion in multiple frame pairs for persistence
    const minActivations = Math.max(1, Math.floor((frames.length - 1) / 2));
    for (let i = 0; i < mask.length; i++) {
      mask[i] = mask[i] >= minActivations ? 1 : 0;
    }

    return mask;
  }

  /**
   * Aggressive morphological cleaning
   * Multiple erosion/dilation passes to remove noise
   */
  private morphologicalClean(
    mask: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    // First erosion pass - 5x5 kernel
    let current = this.erode(mask, width, height, 2, 7);

    // Second erosion for extra noise removal
    current = this.erode(current, width, height, 1, 5);

    // Dilation to restore object size - 5x5 kernel
    current = this.dilate(current, width, height, 2);

    // Second dilation
    current = this.dilate(current, width, height, 2);

    return current;
  }

  private erode(
    mask: Uint8Array,
    width: number,
    height: number,
    radius: number,
    minNeighbors: number
  ): Uint8Array {
    const result = new Uint8Array(mask.length);

    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        const idx = y * width + x;
        let count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nidx = (y + dy) * width + (x + dx);
            count += mask[nidx];
          }
        }

        result[idx] = count >= minNeighbors ? 1 : 0;
      }
    }

    return result;
  }

  private dilate(
    mask: Uint8Array,
    width: number,
    height: number,
    radius: number
  ): Uint8Array {
    const result = new Uint8Array(mask.length);

    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        const idx = y * width + x;
        if (mask[idx] === 1) {
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const nidx = (y + dy) * width + (x + dx);
              result[nidx] = 1;
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Find connected motion regions using flood fill
   */
  private findMotionRegions(
    mask: Uint8Array,
    width: number,
    height: number
  ): { bbox: BoundingBox; centerX: number; centerY: number; area: number }[] {
    const visited = new Uint8Array(mask.length);
    const regions: { bbox: BoundingBox; centerX: number; centerY: number; area: number }[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (mask[idx] === 1 && visited[idx] === 0) {
          const result = this.floodFill(mask, visited, x, y, width, height);

          if (result.area >= this.minBlobArea) {
            regions.push({
              bbox: {
                x: result.minX,
                y: result.minY,
                width: result.maxX - result.minX,
                height: result.maxY - result.minY,
              },
              centerX: result.sumX / result.area,
              centerY: result.sumY / result.area,
              area: result.area,
            });
          }
        }
      }
    }

    return regions;
  }

  private floodFill(
    mask: Uint8Array,
    visited: Uint8Array,
    startX: number,
    startY: number,
    width: number,
    height: number
  ): { minX: number; minY: number; maxX: number; maxY: number; sumX: number; sumY: number; area: number } {
    const stack: [number, number][] = [[startX, startY]];
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;
    let sumX = 0, sumY = 0;
    let area = 0;

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[idx] === 1 || mask[idx] === 0) continue;

      visited[idx] = 1;
      area++;
      sumX += x;
      sumY += y;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // 4-connected
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    return { minX, minY, maxX, maxY, sumX, sumY, area };
  }

  /**
   * Merge nearby motion regions into coherent objects
   */
  private mergeNearbyRegions(
    regions: { bbox: BoundingBox; centerX: number; centerY: number; area: number }[]
  ): { bbox: BoundingBox; centerX: number; centerY: number; area: number }[] {
    if (regions.length <= 1) return regions;

    const merged: typeof regions = [];
    const used = new Set<number>();

    for (let i = 0; i < regions.length; i++) {
      if (used.has(i)) continue;

      let current = { ...regions[i] };
      used.add(i);

      // Find and merge nearby regions
      let changed = true;
      while (changed) {
        changed = false;
        for (let j = 0; j < regions.length; j++) {
          if (used.has(j)) continue;

          const other = regions[j];
          const dx = current.centerX - other.centerX;
          const dy = current.centerY - other.centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < this.mergeDistance) {
            // Merge bounding boxes
            const newMinX = Math.min(current.bbox.x, other.bbox.x);
            const newMinY = Math.min(current.bbox.y, other.bbox.y);
            const newMaxX = Math.max(current.bbox.x + current.bbox.width, other.bbox.x + other.bbox.width);
            const newMaxY = Math.max(current.bbox.y + current.bbox.height, other.bbox.y + other.bbox.height);

            current = {
              bbox: {
                x: newMinX,
                y: newMinY,
                width: newMaxX - newMinX,
                height: newMaxY - newMinY,
              },
              centerX: (newMinX + newMaxX) / 2,
              centerY: (newMinY + newMaxY) / 2,
              area: current.area + other.area,
            };

            used.add(j);
            changed = true;
          }
        }
      }

      merged.push(current);
    }

    return merged;
  }

  /**
   * Update tracked motions with new regions
   */
  private updateTrackedMotions(
    regions: { bbox: BoundingBox; centerX: number; centerY: number; area: number }[]
  ): void {
    const matchedRegions = new Set<number>();
    const matchedTracks = new Set<number>();

    // Match regions to existing tracks by distance
    for (const [id, motion] of this.trackedMotions) {
      let bestMatch = -1;
      let bestDistance = Infinity;

      // Predict next position
      const predictedX = motion.centerX + motion.velocityX;
      const predictedY = motion.centerY + motion.velocityY;

      for (let i = 0; i < regions.length; i++) {
        if (matchedRegions.has(i)) continue;

        const region = regions[i];
        const dx = predictedX - region.centerX;
        const dy = predictedY - region.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Match if close to predicted position
        const maxDistance = Math.max(motion.bbox.width, motion.bbox.height, 100);
        if (distance < maxDistance && distance < bestDistance) {
          bestDistance = distance;
          bestMatch = i;
        }
      }

      if (bestMatch >= 0) {
        const region = regions[bestMatch];

        // Update velocity
        motion.velocityX = region.centerX - motion.centerX;
        motion.velocityY = region.centerY - motion.centerY;

        // Update position
        motion.bbox = region.bbox;
        motion.centerX = region.centerX;
        motion.centerY = region.centerY;
        motion.area = region.area;
        motion.framesSeen++;
        motion.lastSeen = this.frameCount;
        motion.confidence = Math.min(1, motion.framesSeen / 10);

        // Add to trail
        motion.trail.push({ x: region.centerX, y: region.centerY });
        if (motion.trail.length > 100) {
          motion.trail.shift();
        }

        matchedRegions.add(bestMatch);
        matchedTracks.add(id);
      }
    }

    // Create new tracks for unmatched regions
    for (let i = 0; i < regions.length; i++) {
      if (matchedRegions.has(i)) continue;

      const region = regions[i];
      const id = this.nextId++;

      this.trackedMotions.set(id, {
        id,
        bbox: region.bbox,
        centerX: region.centerX,
        centerY: region.centerY,
        velocityX: 0,
        velocityY: 0,
        area: region.area,
        framesSeen: 1,
        lastSeen: this.frameCount,
        confidence: 0,
        trail: [{ x: region.centerX, y: region.centerY }],
      });
    }

    // Age and remove old tracks
    for (const [id, motion] of this.trackedMotions) {
      if (!matchedTracks.has(id)) {
        const age = this.frameCount - motion.lastSeen;
        if (age > 10) {
          this.trackedMotions.delete(id);
        }
      }
    }
  }

  /**
   * Get confirmed detections from tracked motions
   */
  private getConfirmedDetections(): Detection[] {
    const detections: Detection[] = [];

    for (const [, motion] of this.trackedMotions) {
      // Only return motions seen consistently
      if (motion.framesSeen >= 2) {
        detections.push({
          bbox: motion.bbox,
          class: "motion",
          score: motion.confidence,
        });
      }
    }

    return detections;
  }

  /**
   * Reset the motion detector
   */
  reset(): void {
    this.frameBuffer = [];
    this.trackedMotions.clear();
    this.frameCount = 0;
  }

  /**
   * Update configuration
   */
  setConfig(options: {
    threshold?: number;
    minBlobArea?: number;
    bufferSize?: number;
    mergeDistance?: number;
  }): void {
    if (options.threshold !== undefined) this.threshold = options.threshold;
    if (options.minBlobArea !== undefined) this.minBlobArea = options.minBlobArea;
    if (options.bufferSize !== undefined) this.bufferSize = options.bufferSize;
    if (options.mergeDistance !== undefined) this.mergeDistance = options.mergeDistance;
  }
}
