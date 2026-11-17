import type { Stroke } from './index.js';
import { StrokeGeometryCache } from './geometry.js';
import type { Vertex } from './geometry.js';
import { StrokeProcessor } from './stroke.js';
import { drawGeometry, drawStroke } from './render.js';

/** Playback-local, bounded geometry for immutable completed strokes only. */
export class ReplayRenderer {
  private cache = new Map<Stroke, readonly (readonly Vertex[])[] | null>();
  private remaining: number;

  constructor(vertexLimit = 100_000) { this.remaining = vertexLimit; }

  draw(ctx: CanvasRenderingContext2D, visible: readonly Stroke[], source: readonly Stroke[]): void {
    visible.forEach((stroke, index) => {
      // Partial frames are new snapshots; caching them would grow every frame.
      if (stroke !== source[index]) { drawStroke(ctx, stroke); return; }
      if (!this.cache.has(stroke)) {
        let geometry: readonly (readonly Vertex[])[] | null = null;
        if (this.remaining > 0) {
          const builder = new StrokeGeometryCache(this.remaining);
          const processor = new StrokeProcessor(stroke.brush);
          for (const point of stroke.points) {
            builder.append(processor.append(point));
            if (builder.geometry === null) break;
          }
          geometry = builder.geometry;
          if (geometry) this.remaining -= builder.vertexCount;
        }
        // Remember overflow to avoid rebuilding an oversized stroke next frame.
        this.cache.set(stroke, geometry);
      }
      const geometry = this.cache.get(stroke);
      if (geometry) drawGeometry(ctx, stroke.brush.color, geometry);
      else drawStroke(ctx, stroke);
    });
  }
}
