/**
 * Saliency-Based Detector
 * 
 * A smart hybrid algorithm that tracks BOTH motion AND light/luminance.
 * Combines multiple visual cues for comprehensive scene understanding:
 * 
 * 1. Motion Detection - Frame differencing for moving objects
 * 2. Light/Luminance Detection - High-brightness regions (lights, reflections)
 * 3. Light Gradients - Edges of illuminated areas (spotlights, glows)
 * 4. Flicker Detection - Rapid luminance changes (strobe, flashes)
 * 
 * The fusion algorithm weights each cue based on scene characteristics.
 */

import type { BoundingBox, Detection } from "./types";

/** Tracked salient region with hybrid motion+light properties */
interface TrackedSaliency {
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
    trail: { x: number; y: number }[];

    // Hybrid properties
    motionScore: number;      // 0-1, how much motion detected
    luminanceScore: number;   // 0-1, how bright the region is
    gradientScore: number;    // 0-1, edge/gradient strength
    flickerScore: number;     // 0-1, temporal luminance variance
    type: "motion" | "light" | "hybrid" | "flicker";
}

/** Configuration for the saliency detector */
export interface SaliencyConfig {
    // Motion detection
    motionThreshold?: number;       // Pixel difference threshold (0-255)
    motionWeight?: number;          // Weight for motion in fusion (0-1)

    // Luminance/light detection  
    luminanceThreshold?: number;    // Brightness threshold (0-255)
    luminanceWeight?: number;       // Weight for brightness in fusion (0-1)
    adaptiveLuminance?: boolean;    // Use adaptive thresholding based on scene

    // Gradient/edge detection
    gradientThreshold?: number;     // Edge strength threshold
    gradientWeight?: number;        // Weight for gradients in fusion (0-1)

    // Flicker detection
    flickerThreshold?: number;      // Temporal variance threshold
    flickerWeight?: number;         // Weight for flicker in fusion (0-1)
    flickerWindowSize?: number;     // Frames to analyze for flicker

    // General
    minBlobArea?: number;           // Minimum region size
    mergeDistance?: number;         // Distance to merge nearby regions
    bufferSize?: number;            // Frame buffer size
}

const DEFAULT_CONFIG: Required<SaliencyConfig> = {
    motionThreshold: 25,
    motionWeight: 0.4,
    luminanceThreshold: 200,
    luminanceWeight: 0.3,
    adaptiveLuminance: true,
    gradientThreshold: 50,
    gradientWeight: 0.15,
    flickerThreshold: 40,
    flickerWeight: 0.15,
    flickerWindowSize: 5,
    minBlobArea: 150,
    mergeDistance: 60,
    bufferSize: 4,
};

/**
 * Saliency Detector - Hybrid Motion + Light Tracking
 */
export class SaliencyDetector {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    // Frame buffers
    private frameBuffer: ImageData[] = [];
    private luminanceBuffer: Float32Array[] = [];
    private frameCount = 0;

    // Tracked regions
    private trackedSaliency: Map<number, TrackedSaliency> = new Map();
    private nextId = 1;

    // Scene statistics (for adaptive thresholding)
    private sceneMeanLuminance = 128;
    private sceneStdLuminance = 50;

    // Configuration
    private config: Required<SaliencyConfig>;

    constructor(options: SaliencyConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...options };

        this.canvas = document.createElement("canvas");
        const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Failed to get 2D context");
        this.ctx = ctx;
    }

    /**
     * Detect salient regions (motion + light) in the frame
     */
    detect(
        input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
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
            this.luminanceBuffer = [];
            this.trackedSaliency.clear();
        }

        // Draw and capture current frame
        this.ctx.drawImage(input, 0, 0);
        const currentFrame = this.ctx.getImageData(0, 0, width, height);

        // Compute luminance map
        const luminance = this.computeLuminance(currentFrame.data, width, height);

        // Update scene statistics for adaptive thresholding
        this.updateSceneStats(luminance);

        // Update buffers
        this.frameBuffer.push(currentFrame);
        this.luminanceBuffer.push(luminance);

        if (this.frameBuffer.length > this.config.bufferSize) {
            this.frameBuffer.shift();
            this.luminanceBuffer.shift();
        }

        // Need at least 2 frames
        if (this.frameBuffer.length < 2) {
            this.frameCount++;
            return [];
        }

        // === COMPUTE SALIENCY MAPS ===

        // 1. Motion saliency (frame differencing)
        const motionMap = this.computeMotionMap(width, height);

        // 2. Luminance saliency (bright regions)
        const luminanceMap = this.computeLuminanceMap(luminance, width, height);

        // 3. Gradient saliency (edges of light)
        const gradientMap = this.computeGradientMap(luminance, width, height);

        // 4. Flicker saliency (temporal variance)
        const flickerMap = this.computeFlickerMap(width, height);

        // === FUSE SALIENCY MAPS ===
        const fusedMap = this.fuseSaliencyMaps(
            motionMap,
            luminanceMap,
            gradientMap,
            flickerMap,
            width,
            height
        );

        // Apply morphological cleaning
        const cleanedMap = this.morphologicalClean(fusedMap, width, height);

        // Find connected regions with type classification
        const regions = this.findSalientRegions(
            cleanedMap,
            motionMap,
            luminanceMap,
            gradientMap,
            flickerMap,
            width,
            height
        );

        // Merge nearby regions
        const mergedRegions = this.mergeNearbyRegions(regions);

        // Update tracked saliency
        this.updateTrackedSaliency(mergedRegions);

        // Get confirmed detections
        const detections = this.getConfirmedDetections();

        this.frameCount++;
        return detections;
    }

    /**
     * Compute luminance (brightness) for each pixel
     * Uses ITU-R BT.709 coefficients for perceptual accuracy
     */
    private computeLuminance(
        data: Uint8ClampedArray,
        width: number,
        height: number
    ): Float32Array {
        const luminance = new Float32Array(width * height);

        for (let i = 0; i < data.length; i += 4) {
            const idx = i / 4;
            // Y = 0.2126 R + 0.7152 G + 0.0722 B (ITU-R BT.709)
            luminance[idx] = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
        }

        return luminance;
    }

    /**
     * Update scene-level statistics for adaptive thresholding
     */
    private updateSceneStats(luminance: Float32Array): void {
        // Sample every 8th pixel for performance
        let sum = 0;
        let sumSq = 0;
        let count = 0;

        for (let i = 0; i < luminance.length; i += 8) {
            sum += luminance[i];
            sumSq += luminance[i] * luminance[i];
            count++;
        }

        const mean = sum / count;
        const variance = sumSq / count - mean * mean;
        const std = Math.sqrt(Math.max(0, variance));

        // Exponential moving average for smooth adaptation
        const alpha = 0.1;
        this.sceneMeanLuminance = this.sceneMeanLuminance * (1 - alpha) + mean * alpha;
        this.sceneStdLuminance = this.sceneStdLuminance * (1 - alpha) + std * alpha;
    }

    /**
     * Compute motion saliency map using accumulated frame differences
     */
    private computeMotionMap(width: number, height: number): Float32Array {
        const map = new Float32Array(width * height);
        const frames = this.frameBuffer;

        for (let f = 1; f < frames.length; f++) {
            const current = frames[f].data;
            const previous = frames[f - 1].data;

            for (let i = 0; i < current.length; i += 4) {
                const idx = i / 4;

                // Color difference (luminance-weighted)
                const diffR = Math.abs(current[i] - previous[i]);
                const diffG = Math.abs(current[i + 1] - previous[i + 1]);
                const diffB = Math.abs(current[i + 2] - previous[i + 2]);
                const diff = diffR * 0.299 + diffG * 0.587 + diffB * 0.114;

                if (diff > this.config.motionThreshold) {
                    map[idx] += diff / 255;
                }
            }
        }

        // Normalize by number of comparisons
        const numComparisons = frames.length - 1;
        if (numComparisons > 0) {
            for (let i = 0; i < map.length; i++) {
                map[i] = Math.min(1, map[i] / numComparisons);
            }
        }

        return map;
    }

    /**
     * Compute luminance saliency map (bright regions detection)
     */
    private computeLuminanceMap(
        luminance: Float32Array,
        width: number,
        height: number
    ): Float32Array {
        const map = new Float32Array(width * height);

        // Adaptive threshold based on scene statistics
        const threshold = this.config.adaptiveLuminance
            ? Math.min(250, this.sceneMeanLuminance + 1.5 * this.sceneStdLuminance)
            : this.config.luminanceThreshold;

        for (let i = 0; i < luminance.length; i++) {
            if (luminance[i] > threshold) {
                // Normalize to 0-1, with smooth falloff
                map[i] = Math.min(1, (luminance[i] - threshold) / (255 - threshold) * 1.5);
            }
        }

        return map;
    }

    /**
     * Compute gradient saliency map (edges of illuminated areas)
     * Uses Sobel operator for edge detection
     */
    private computeGradientMap(
        luminance: Float32Array,
        width: number,
        height: number
    ): Float32Array {
        const map = new Float32Array(width * height);

        // Sobel kernels
        // Gx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]
        // Gy = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;

                // Get 3x3 neighborhood
                const tl = luminance[(y - 1) * width + (x - 1)];
                const tc = luminance[(y - 1) * width + x];
                const tr = luminance[(y - 1) * width + (x + 1)];
                const ml = luminance[y * width + (x - 1)];
                const mr = luminance[y * width + (x + 1)];
                const bl = luminance[(y + 1) * width + (x - 1)];
                const bc = luminance[(y + 1) * width + x];
                const br = luminance[(y + 1) * width + (x + 1)];

                // Sobel gradients
                const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
                const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;

                // Gradient magnitude
                const magnitude = Math.sqrt(gx * gx + gy * gy);

                if (magnitude > this.config.gradientThreshold) {
                    map[idx] = Math.min(1, (magnitude - this.config.gradientThreshold) / 200);
                }
            }
        }

        return map;
    }

    /**
     * Compute flicker saliency map (temporal luminance variance)
     * Detects strobe lights, flashes, and rapid brightness changes
     */
    private computeFlickerMap(width: number, height: number): Float32Array {
        const map = new Float32Array(width * height);

        if (this.luminanceBuffer.length < 2) return map;

        // Compute temporal variance at each pixel
        const n = this.luminanceBuffer.length;

        for (let i = 0; i < width * height; i++) {
            // Calculate variance across frames
            let sum = 0;
            let sumSq = 0;

            for (let f = 0; f < n; f++) {
                const val = this.luminanceBuffer[f][i];
                sum += val;
                sumSq += val * val;
            }

            const mean = sum / n;
            const variance = sumSq / n - mean * mean;
            const std = Math.sqrt(Math.max(0, variance));

            if (std > this.config.flickerThreshold) {
                // Normalize flicker strength
                map[i] = Math.min(1, (std - this.config.flickerThreshold) / 100);
            }
        }

        return map;
    }

    /**
     * Fuse multiple saliency maps into a single combined map
     */
    private fuseSaliencyMaps(
        motion: Float32Array,
        luminance: Float32Array,
        gradient: Float32Array,
        flicker: Float32Array,
        width: number,
        height: number
    ): Float32Array {
        const fused = new Float32Array(width * height);
        const { motionWeight, luminanceWeight, gradientWeight, flickerWeight } = this.config;

        // Normalize weights to sum to 1
        const totalWeight = motionWeight + luminanceWeight + gradientWeight + flickerWeight;
        const wMotion = motionWeight / totalWeight;
        const wLum = luminanceWeight / totalWeight;
        const wGrad = gradientWeight / totalWeight;
        const wFlick = flickerWeight / totalWeight;

        for (let i = 0; i < fused.length; i++) {
            // Weighted combination
            const combined =
                motion[i] * wMotion +
                luminance[i] * wLum +
                gradient[i] * wGrad +
                flicker[i] * wFlick;

            // Non-linear boost for strong signals (makes peaks stand out)
            fused[i] = Math.pow(combined, 0.8);
        }

        return fused;
    }

    /**
     * Morphological cleaning (erosion + dilation)
     */
    private morphologicalClean(
        map: Float32Array,
        width: number,
        height: number
    ): Uint8Array {
        // Binarize first
        const binary = new Uint8Array(map.length);
        const threshold = 0.15; // Activation threshold

        for (let i = 0; i < map.length; i++) {
            binary[i] = map[i] > threshold ? 1 : 0;
        }

        // Erode
        let current = this.erode(binary, width, height, 2, 5);

        // Dilate
        current = this.dilate(current, width, height, 3);
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
     * Find connected salient regions and classify their type
     */
    private findSalientRegions(
        mask: Uint8Array,
        motionMap: Float32Array,
        luminanceMap: Float32Array,
        gradientMap: Float32Array,
        flickerMap: Float32Array,
        width: number,
        height: number
    ): (TrackedSaliency & { isNew: true })[] {
        const visited = new Uint8Array(mask.length);
        const regions: (TrackedSaliency & { isNew: true })[] = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (mask[idx] === 1 && visited[idx] === 0) {
                    const result = this.floodFillWithScores(
                        mask,
                        visited,
                        motionMap,
                        luminanceMap,
                        gradientMap,
                        flickerMap,
                        x,
                        y,
                        width,
                        height
                    );

                    if (result.area >= this.config.minBlobArea) {
                        // Classify the region type based on dominant saliency
                        const motionScore = result.motionSum / result.area;
                        const luminanceScore = result.luminanceSum / result.area;
                        const gradientScore = result.gradientSum / result.area;
                        const flickerScore = result.flickerSum / result.area;

                        let type: TrackedSaliency["type"] = "hybrid";
                        const maxScore = Math.max(motionScore, luminanceScore, flickerScore);

                        if (flickerScore > 0.3 && flickerScore >= maxScore * 0.8) {
                            type = "flicker";
                        } else if (motionScore >= luminanceScore * 1.5 && motionScore > 0.2) {
                            type = "motion";
                        } else if (luminanceScore >= motionScore * 1.5 && luminanceScore > 0.2) {
                            type = "light";
                        }

                        regions.push({
                            id: 0, // Will be assigned later
                            bbox: {
                                x: result.minX,
                                y: result.minY,
                                width: result.maxX - result.minX,
                                height: result.maxY - result.minY,
                            },
                            centerX: result.sumX / result.area,
                            centerY: result.sumY / result.area,
                            velocityX: 0,
                            velocityY: 0,
                            area: result.area,
                            framesSeen: 1,
                            lastSeen: this.frameCount,
                            confidence: 0,
                            trail: [],
                            motionScore,
                            luminanceScore,
                            gradientScore,
                            flickerScore,
                            type,
                            isNew: true,
                        });
                    }
                }
            }
        }

        return regions;
    }

    private floodFillWithScores(
        mask: Uint8Array,
        visited: Uint8Array,
        motionMap: Float32Array,
        luminanceMap: Float32Array,
        gradientMap: Float32Array,
        flickerMap: Float32Array,
        startX: number,
        startY: number,
        width: number,
        height: number
    ): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        sumX: number;
        sumY: number;
        area: number;
        motionSum: number;
        luminanceSum: number;
        gradientSum: number;
        flickerSum: number;
    } {
        const stack: [number, number][] = [[startX, startY]];
        let minX = startX,
            maxX = startX;
        let minY = startY,
            maxY = startY;
        let sumX = 0,
            sumY = 0;
        let area = 0;
        let motionSum = 0,
            luminanceSum = 0,
            gradientSum = 0,
            flickerSum = 0;

        while (stack.length > 0) {
            const [x, y] = stack.pop()!;
            const idx = y * width + x;

            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            if (visited[idx] === 1 || mask[idx] === 0) continue;

            visited[idx] = 1;
            area++;
            sumX += x;
            sumY += y;

            // Accumulate saliency scores
            motionSum += motionMap[idx];
            luminanceSum += luminanceMap[idx];
            gradientSum += gradientMap[idx];
            flickerSum += flickerMap[idx];

            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);

            // 4-connected
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }

        return {
            minX,
            minY,
            maxX,
            maxY,
            sumX,
            sumY,
            area,
            motionSum,
            luminanceSum,
            gradientSum,
            flickerSum,
        };
    }

    /**
     * Merge nearby regions
     */
    private mergeNearbyRegions<T extends { bbox: BoundingBox; centerX: number; centerY: number; area: number }>(
        regions: T[]
    ): T[] {
        if (regions.length <= 1) return regions;

        const merged: T[] = [];
        const used = new Set<number>();

        for (let i = 0; i < regions.length; i++) {
            if (used.has(i)) continue;

            let current = { ...regions[i] };
            used.add(i);

            let changed = true;
            while (changed) {
                changed = false;
                for (let j = 0; j < regions.length; j++) {
                    if (used.has(j)) continue;

                    const other = regions[j];
                    const dx = current.centerX - other.centerX;
                    const dy = current.centerY - other.centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < this.config.mergeDistance) {
                        const newMinX = Math.min(current.bbox.x, other.bbox.x);
                        const newMinY = Math.min(current.bbox.y, other.bbox.y);
                        const newMaxX = Math.max(
                            current.bbox.x + current.bbox.width,
                            other.bbox.x + other.bbox.width
                        );
                        const newMaxY = Math.max(
                            current.bbox.y + current.bbox.height,
                            other.bbox.y + other.bbox.height
                        );

                        current = {
                            ...current,
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
     * Update tracked saliency with new regions
     */
    private updateTrackedSaliency(
        regions: (TrackedSaliency & { isNew?: boolean })[]
    ): void {
        const matchedRegions = new Set<number>();
        const matchedTracks = new Set<number>();

        // Match regions to existing tracks
        for (const [id, tracked] of this.trackedSaliency) {
            let bestMatch = -1;
            let bestDistance = Infinity;

            const predictedX = tracked.centerX + tracked.velocityX;
            const predictedY = tracked.centerY + tracked.velocityY;

            for (let i = 0; i < regions.length; i++) {
                if (matchedRegions.has(i)) continue;

                const region = regions[i];
                const dx = predictedX - region.centerX;
                const dy = predictedY - region.centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                const maxDistance = Math.max(tracked.bbox.width, tracked.bbox.height, 100);
                if (distance < maxDistance && distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = i;
                }
            }

            if (bestMatch >= 0) {
                const region = regions[bestMatch];

                tracked.velocityX = region.centerX - tracked.centerX;
                tracked.velocityY = region.centerY - tracked.centerY;
                tracked.bbox = region.bbox;
                tracked.centerX = region.centerX;
                tracked.centerY = region.centerY;
                tracked.area = region.area;
                tracked.framesSeen++;
                tracked.lastSeen = this.frameCount;
                tracked.confidence = Math.min(1, tracked.framesSeen / 8);

                // Update scores with exponential moving average
                tracked.motionScore = tracked.motionScore * 0.7 + region.motionScore * 0.3;
                tracked.luminanceScore = tracked.luminanceScore * 0.7 + region.luminanceScore * 0.3;
                tracked.gradientScore = tracked.gradientScore * 0.7 + region.gradientScore * 0.3;
                tracked.flickerScore = tracked.flickerScore * 0.7 + region.flickerScore * 0.3;
                tracked.type = region.type;

                tracked.trail.push({ x: region.centerX, y: region.centerY });
                if (tracked.trail.length > 100) {
                    tracked.trail.shift();
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

            this.trackedSaliency.set(id, {
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
                motionScore: region.motionScore,
                luminanceScore: region.luminanceScore,
                gradientScore: region.gradientScore,
                flickerScore: region.flickerScore,
                type: region.type,
            });
        }

        // Age and remove old tracks
        for (const [id, tracked] of this.trackedSaliency) {
            if (!matchedTracks.has(id)) {
                const age = this.frameCount - tracked.lastSeen;
                if (age > 12) {
                    this.trackedSaliency.delete(id);
                }
            }
        }
    }

    /**
     * Get confirmed detections from tracked saliency
     */
    private getConfirmedDetections(): Detection[] {
        const detections: Detection[] = [];

        for (const [, tracked] of this.trackedSaliency) {
            if (tracked.framesSeen >= 2) {
                // Map type to class name for display
                let className: string;
                switch (tracked.type) {
                    case "motion":
                        className = "motion";
                        break;
                    case "light":
                        className = "light";
                        break;
                    case "flicker":
                        className = "flash";
                        break;
                    case "hybrid":
                    default:
                        className = "salient";
                }

                detections.push({
                    bbox: tracked.bbox,
                    class: className,
                    score: tracked.confidence,
                });
            }
        }

        return detections;
    }

    /**
     * Reset the detector
     */
    reset(): void {
        this.frameBuffer = [];
        this.luminanceBuffer = [];
        this.trackedSaliency.clear();
        this.frameCount = 0;
        this.sceneMeanLuminance = 128;
        this.sceneStdLuminance = 50;
    }

    /**
     * Update configuration
     */
    setConfig(options: Partial<SaliencyConfig>): void {
        this.config = { ...this.config, ...options };
    }

    /**
     * Get current configuration
     */
    getConfig(): Required<SaliencyConfig> {
        return { ...this.config };
    }

    /**
     * Get scene statistics (useful for debugging/UI)
     */
    getSceneStats(): { meanLuminance: number; stdLuminance: number } {
        return {
            meanLuminance: this.sceneMeanLuminance,
            stdLuminance: this.sceneStdLuminance,
        };
    }
}
