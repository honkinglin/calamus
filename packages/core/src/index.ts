export { createStrokeGeometry } from './geometry.js';
export type { Vertex } from './geometry.js';
export { processStroke } from './stroke.js';
export type { RenderPoint } from './stroke.js';

export interface Point {
  x: number;
  y: number;
  pressure: number | null;
  time: number;
}

export interface Brush {
  color: string;
  size: number;
  smoothing?: number;
  stabilizer?: number;
  velocityWidth?: boolean;
}

export interface Stroke {
  brush: Brush;
  points: Point[];
}

export const PAPER = { width: 1000, height: 700 };

export { drawStroke } from './render.js';

export { Calamus } from './engine.js';
export type { CalamusOptions, HistoryState, ReplayState, PNGExportOptions } from './engine.js';

export { parseDocument } from './document.js';
export type { CalamusDocument } from './document.js';

export { createSVG } from './export.js';

export type { CropOptions } from './bounds.js';
