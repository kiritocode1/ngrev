/**
 * Type definitions for the video tracking system
 */

/** Bounding box coordinates */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Raw detection from TensorFlow.js model */
export interface Detection {
  bbox: BoundingBox;
  class: string;
  score: number;
}

/** Tracked object with persistent ID */
export interface Track {
  id: number;
  bbox: BoundingBox;
  class: string;
  score: number;
  age: number; // frames since creation
  timeSinceUpdate: number; // frames since last detection match
  velocity: { x: number; y: number };
  history: BoundingBox[]; // for trail visualization
}

/** Configuration options for the tracker */
export interface TrackerConfig {
  /** Minimum IoU threshold for matching detections to tracks */
  iouThreshold: number;
  /** Maximum frames a track can go without update before removal */
  maxAge: number;
  /** Minimum detections before a track is considered confirmed */
  minHits: number;
  /** Maximum distance for constellation lines */
  maxLineDistance: number;
}

/** Bounding box visualization style */
export type BoundingBoxStyle = "basic" | "corner-l" | "frame" | "dash" | "grid" | "scope" | "none";

/** Configuration for the visualization renderer */
export interface RendererConfig {
  /** Box stroke color */
  boxColor: string;
  /** Box stroke width */
  boxWidth: number;
  /** Label font */
  labelFont: string;
  /** Constellation line color */
  lineColor: string;
  /** Constellation line width */
  lineWidth: number;
  /** Show confidence scores */
  showScores: boolean;
  /** Show track IDs */
  showIds: boolean;
  /** Show constellation lines */
  showLines: boolean;
  /** Maximum history length for trails */
  trailLength: number;
  /** Box visualization style */
  boxStyle: BoundingBoxStyle;
  /** Fixed box size in pixels (0 = auto/fit to object) */
  fixedBoxSize: number;
  /** Show text labels (IDs, scores) */
  showLabels: boolean;
  /** Font size in pixels */
  fontSize: number;
  /** Position of the label relative to the box */
  textPosition: "top" | "bottom" | "center";
}

/** Default tracker configuration */
export const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
  iouThreshold: 0.2,
  maxAge: 2, // Remove tracks immediately when lost (very fast cleanup)
  minHits: 2, // Require more consistency before showing
  maxLineDistance: 300,
};

/** Default renderer configuration */
export const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  boxColor: "#ffffff",
  boxWidth: 2,
  labelFont: "12px Inter, system-ui, sans-serif",
  lineColor: "rgba(255, 255, 255, 0.3)",
  lineWidth: 1,
  showScores: true,
  showIds: true,
  showLines: true,
  trailLength: 10,
  boxStyle: "basic", // Default to basic box
  fixedBoxSize: 0, // 0 = Auto
  showLabels: true,
  fontSize: 12,
  textPosition: "top",
};
