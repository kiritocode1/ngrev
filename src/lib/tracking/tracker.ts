/**
 * Multi-Object Tracker optimized for Motion Detection
 *
 * Uses a combination of IoU and distance-based matching
 * for better tracking of moving objects
 */

import type { BoundingBox, Detection, Track, TrackerConfig } from "./types";
import { DEFAULT_TRACKER_CONFIG } from "./types";

let nextTrackId = 1;

/**
 * Calculate Intersection over Union (IoU) between two bounding boxes
 */
function calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;

  return union > 0 ? intersection / union : 0;
}

/**
 * Get center point of a bounding box
 */
function getCenter(bbox: BoundingBox): { x: number; y: number } {
  return {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
  };
}

/**
 * Calculate distance between two points
 */
function calculateDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Predict next bounding box position using velocity
 */
function predictNextPosition(track: Track): BoundingBox {
  return {
    x: track.bbox.x + track.velocity.x,
    y: track.bbox.y + track.velocity.y,
    width: track.bbox.width,
    height: track.bbox.height,
  };
}

/**
 * Match detections to tracks using a combination of IoU and distance
 */
function matchDetectionsToTracks(
  detections: Detection[],
  tracks: Track[],
  iouThreshold: number,
): {
  matched: [number, number][];
  unmatchedDetections: number[];
  unmatchedTracks: number[];
} {
  const matched: [number, number][] = [];
  const usedDetections = new Set<number>();
  const usedTracks = new Set<number>();

  // Build combined score matrix (IoU + distance)
  const scoreMatrix: { di: number; ti: number; score: number; iou: number; distance: number }[] = [];

  for (let di = 0; di < detections.length; di++) {
    const detCenter = getCenter(detections[di].bbox);

    for (let ti = 0; ti < tracks.length; ti++) {
      const predictedBox = predictNextPosition(tracks[ti]);
      const predictedCenter = getCenter(predictedBox);

      const iou = calculateIoU(detections[di].bbox, predictedBox);
      const distance = calculateDistance(detCenter, predictedCenter);

      // Calculate combined score
      // Use distance-based matching if IoU is too low
      const maxDist = Math.max(tracks[ti].bbox.width, tracks[ti].bbox.height, 150);
      const distanceScore = Math.max(0, 1 - distance / maxDist);

      // Combined score: prefer IoU, but use distance as fallback
      const score = iou > 0.05 ? iou + distanceScore * 0.5 : distanceScore * 0.8;

      if (score >= iouThreshold || distance < maxDist) {
        scoreMatrix.push({ di, ti, score, iou, distance });
      }
    }
  }

  // Sort by combined score descending and greedily match
  scoreMatrix.sort((a, b) => b.score - a.score);

  for (const { di, ti } of scoreMatrix) {
    if (!usedDetections.has(di) && !usedTracks.has(ti)) {
      matched.push([di, ti]);
      usedDetections.add(di);
      usedTracks.add(ti);
    }
  }

  const unmatchedDetections = detections
    .map((_, i) => i)
    .filter((i) => !usedDetections.has(i));
  const unmatchedTracks = tracks
    .map((_, i) => i)
    .filter((i) => !usedTracks.has(i));

  return { matched, unmatchedDetections, unmatchedTracks };
}

/**
 * Multi-Object Tracker class
 */
export class Tracker {
  private tracks: Track[] = [];
  private config: TrackerConfig;

  constructor(config: Partial<TrackerConfig> = {}) {
    this.config = { ...DEFAULT_TRACKER_CONFIG, ...config };
  }

  /**
   * Update tracker with new detections
   */
  update(detections: Detection[]): Track[] {
    // Step 1: Match detections to existing tracks
    const { matched, unmatchedDetections, unmatchedTracks } =
      matchDetectionsToTracks(
        detections,
        this.tracks,
        this.config.iouThreshold,
      );

    // Step 2: Update matched tracks
    for (const [di, ti] of matched) {
      const detection = detections[di];
      const track = this.tracks[ti];

      // Calculate velocity from position change (smoothed)
      const oldCenter = getCenter(track.bbox);
      const newCenter = getCenter(detection.bbox);
      const newVelocityX = newCenter.x - oldCenter.x;
      const newVelocityY = newCenter.y - oldCenter.y;

      // Smooth velocity with exponential moving average
      const alpha = 0.7;
      track.velocity = {
        x: track.velocity.x * (1 - alpha) + newVelocityX * alpha,
        y: track.velocity.y * (1 - alpha) + newVelocityY * alpha,
      };

      // Update track state
      track.bbox = detection.bbox;
      track.score = detection.score;
      track.class = detection.class;
      track.age++;
      track.timeSinceUpdate = 0;

      // Add to history for trail visualization
      track.history.push({ ...detection.bbox });
      if (track.history.length > 100) {
        track.history.shift();
      }
    }

    // Step 3: Age unmatched tracks and keep predicting
    for (const ti of unmatchedTracks) {
      const track = this.tracks[ti];
      track.timeSinceUpdate++;
      track.age++;

      // Apply velocity prediction (damped)
      if (track.timeSinceUpdate <= 5) {
        const predicted = predictNextPosition(track);
        track.bbox = predicted;
        // Dampen velocity over time
        track.velocity.x *= 0.9;
        track.velocity.y *= 0.9;

        // Still add to history for trail continuation
        track.history.push({ ...track.bbox });
        if (track.history.length > 100) {
          track.history.shift();
        }
      }
    }

    // Step 4: Create new tracks for unmatched detections
    for (const di of unmatchedDetections) {
      const detection = detections[di];
      const newTrack: Track = {
        id: nextTrackId++,
        bbox: detection.bbox,
        class: detection.class,
        score: detection.score,
        age: 1,
        timeSinceUpdate: 0,
        velocity: { x: 0, y: 0 },
        history: [{ ...detection.bbox }],
      };
      this.tracks.push(newTrack);
    }

    // Step 5: Remove dead tracks
    this.tracks = this.tracks.filter(
      (track) => track.timeSinceUpdate < this.config.maxAge,
    );

    // Return tracks (all active, not just confirmed)
    return this.tracks.filter(
      (track) =>
        track.age >= this.config.minHits || track.timeSinceUpdate === 0,
    );
  }

  /**
   * Get all active tracks
   */
  getTracks(): Track[] {
    return this.tracks;
  }

  /**
   * Reset all tracks
   */
  reset(): void {
    this.tracks = [];
    nextTrackId = 1;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<TrackerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
