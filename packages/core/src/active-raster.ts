import { canBatchOpaque, drawGeometry } from './render.js';
import type { Vertex } from './geometry.js';

type Geometry = readonly (readonly Vertex[])[];

/** Gesture-local opaque prefix. Tail polygons remain transient until a full batch is available. */
export class ActiveStrokeRaster {
  private canvas?: HTMLCanvasElement;
  private completed = 0;
  private color = '';

  constructor(private readonly createCanvas: () => HTMLCanvasElement, private readonly pixelLimit = 4_000_000) {}

  draw(ctx: CanvasRenderingContext2D, color: string, geometry: Geometry,
    pixelWidth: number, pixelHeight: number, width: number, height: number): boolean {
    const full = Math.floor(geometry.length / 64) * 64;
    if (!canBatchOpaque(ctx, color) || !full || pixelWidth * pixelHeight > this.pixelLimit) {
      this.dispose();
      return false;
    }
    const canvas = this.canvas ??= this.createCanvas();
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight || this.color !== color || full < this.completed) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      this.completed = 0;
      this.color = color;
    }
    const cached = canvas.getContext('2d');
    if (!cached) { this.dispose(); return false; }
    cached.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    if (this.completed < full) {
      drawGeometry(cached, color, range(geometry, this.completed, full));
      this.completed = full;
    }
    ctx.drawImage(canvas, 0, 0, width, height);
    if (full < geometry.length) drawGeometry(ctx, color, range(geometry, full, geometry.length));
    return true;
  }

  dispose(): void {
    if (this.canvas) { this.canvas.width = 0; this.canvas.height = 0; }
    this.canvas = undefined;
    this.completed = 0;
    this.color = '';
  }
}

function* range(geometry: Geometry, start: number, end: number): Generator<readonly Vertex[]> {
  for (let i = start; i < end; i++) yield geometry[i];
}
