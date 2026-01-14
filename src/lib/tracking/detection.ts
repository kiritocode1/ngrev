/**
 * TensorFlow.js COCO-SSD Detection Service
 *
 * Handles model loading and object detection on video frames
 */

import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import type { BoundingBox, Detection } from "./types";

let model: cocoSsd.ObjectDetection | null = null;
let isLoading = false;

/**
 * Load the COCO-SSD model
 * @returns Promise that resolves when model is loaded
 */
export async function loadModel(): Promise<void> {
  if (model) return;
  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return;
  }

  isLoading = true;
  try {
    // Use WebGL backend for GPU acceleration
    await tf.setBackend("webgl");
    await tf.ready();

    model = await cocoSsd.load({
      base: "lite_mobilenet_v2", // Faster, smaller model
    });

    console.log("✅ COCO-SSD model loaded successfully");
  } catch (error) {
    console.error("❌ Failed to load COCO-SSD model:", error);
    throw error;
  } finally {
    isLoading = false;
  }
}

/**
 * Check if model is ready for inference
 */
export function isModelReady(): boolean {
  return model !== null;
}

/**
 * Run object detection on an image/video frame
 * @param input - HTMLVideoElement, HTMLImageElement, or HTMLCanvasElement
 * @param minScore - Minimum confidence score threshold (0-1)
 * @returns Array of detections
 */
export async function detect(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  minScore = 0.5,
  minArea = 0,
): Promise<Detection[]> {
  if (!model) {
    throw new Error("Model not loaded. Call loadModel() first.");
  }

  const predictions = await model.detect(input, undefined, minScore);

  return predictions
    .map((pred) => ({
      bbox: {
        x: pred.bbox[0],
        y: pred.bbox[1],
        width: pred.bbox[2],
        height: pred.bbox[3],
      } as BoundingBox,
      class: pred.class,
      score: pred.score,
    }))
    .filter((detection) => {
      const area = detection.bbox.width * detection.bbox.height;
      return area >= minArea;
    });
}

/**
 * Cleanup and dispose of the model
 */
export function disposeModel(): void {
  if (model) {
    // COCO-SSD doesn't have a dispose method, but we can clear the reference
    model = null;
  }
}
