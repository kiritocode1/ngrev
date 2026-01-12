/**
 * IoU-based Multi-Object Tracker
 *
 * Implements a simple but effective tracking algorithm:
 * 1. Predict next position using velocity
 * 2. Match detections to existing tracks using IoU
 * 3. Update matched tracks, create new ones for unmatched detections
 * 4. Remove stale tracks
 */

import type {
    Detection,
    Track,
    BoundingBox,
    TrackerConfig,
} from "./types";
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
 * Hungarian algorithm simplified - greedy IoU matching
 * Returns array of [detectionIndex, trackIndex] pairs
 */
function matchDetectionsToTracks(
    detections: Detection[],
    tracks: Track[],
    iouThreshold: number
): { matched: [number, number][]; unmatchedDetections: number[]; unmatchedTracks: number[] } {
    const matched: [number, number][] = [];
    const usedDetections = new Set<number>();
    const usedTracks = new Set<number>();

    // Build IoU matrix
    const iouMatrix: { di: number; ti: number; iou: number }[] = [];
    for (let di = 0; di < detections.length; di++) {
        for (let ti = 0; ti < tracks.length; ti++) {
            const predictedBox = predictNextPosition(tracks[ti]);
            const iou = calculateIoU(detections[di].bbox, predictedBox);
            if (iou >= iouThreshold) {
                iouMatrix.push({ di, ti, iou });
            }
        }
    }

    // Sort by IoU descending and greedily match
    iouMatrix.sort((a, b) => b.iou - a.iou);
    for (const { di, ti } of iouMatrix) {
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
     * @param detections - Array of detections from the current frame
     * @returns Array of active tracks
     */
    update(detections: Detection[]): Track[] {
        // Step 1: Match detections to existing tracks
        const { matched, unmatchedDetections, unmatchedTracks } =
            matchDetectionsToTracks(detections, this.tracks, this.config.iouThreshold);

        // Step 2: Update matched tracks
        for (const [di, ti] of matched) {
            const detection = detections[di];
            const track = this.tracks[ti];

            // Calculate velocity from position change
            const oldCenter = getCenter(track.bbox);
            const newCenter = getCenter(detection.bbox);
            track.velocity = {
                x: newCenter.x - oldCenter.x,
                y: newCenter.y - oldCenter.y,
            };

            // Update track state
            track.bbox = detection.bbox;
            track.score = detection.score;
            track.class = detection.class;
            track.age++;
            track.timeSinceUpdate = 0;

            // Add to history for trail visualization
            track.history.push({ ...detection.bbox });
            if (track.history.length > 30) {
                track.history.shift();
            }
        }

        // Step 3: Age unmatched tracks
        for (const ti of unmatchedTracks) {
            this.tracks[ti].timeSinceUpdate++;
            this.tracks[ti].age++;

            // Apply velocity prediction
            const predicted = predictNextPosition(this.tracks[ti]);
            this.tracks[ti].bbox = predicted;
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
            (track) => track.timeSinceUpdate < this.config.maxAge
        );

        // Return only confirmed tracks (min hits) or recently updated tracks
        return this.tracks.filter(
            (track) => track.age >= this.config.minHits || track.timeSinceUpdate === 0
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
