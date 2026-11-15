import type { Vertex } from './geometry.js';

/** Append-only gesture geometry; retain one fill for translucent overlap semantics. */
export class ActiveStrokePath {
  private path?: Path2D;
  private completed = 0;
  private vertices = 0;
  private overflow = false;
  constructor(private readonly createPath: (() => Path2D) | undefined =
    typeof Path2D === 'undefined' ? undefined : () => new Path2D(), private readonly vertexLimit = 100_000) {}

  draw(ctx: CanvasRenderingContext2D, color: string, geometry: readonly (readonly Vertex[])[]): boolean {
    if (!this.createPath || this.overflow) return false;
    if (geometry.length < this.completed) this.dispose();
    let added = 0;
    for (let i = this.completed; i < geometry.length; i++) added += geometry[i].length;
    if (this.vertices + added > this.vertexLimit) {
      this.dispose(); this.overflow = true; return false;
    }
    const path = this.path ??= this.createPath();
    for (let i = this.completed; i < geometry.length; i++) {
      const polygon = geometry[i];
      if (!polygon.length) continue;
      path.moveTo(polygon[0].x, polygon[0].y);
      for (let j = 1; j < polygon.length; j++) path.lineTo(polygon[j].x, polygon[j].y);
      path.closePath();
    }
    this.completed = geometry.length;
    this.vertices += added;
    ctx.fillStyle = color;
    ctx.fill(path, 'nonzero');
    return true;
  }

  dispose(): void {
    this.path = undefined; this.completed = 0; this.vertices = 0; this.overflow = false;
  }
}
