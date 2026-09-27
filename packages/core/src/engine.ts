import { drawStroke, PAPER } from './index.js';
import type { Brush, Point, Stroke } from './index.js';

export interface CalamusOptions {
  width?: number;
  height?: number;
  brush?: Partial<Brush>;
  onStroke?: (stroke: Stroke) => void;
}

/** Owns pointer input and renders strokes in document coordinates. */
export class Calamus {
  private strokes: Stroke[] = [];
  private committedCanvas: HTMLCanvasElement;
  private committedDirty = true;
  private resolutionQuery?: MediaQueryList;
  private brush: Brush;
  private active: { id: number; start: number; stroke: Stroke } | null = null;
  private observer: ResizeObserver;
  private controller = new AbortController();
  private frame = 0;
  private destroyed = false;
  private originalTouchAction: string;
  readonly width: number;
  readonly height: number;

  constructor(private canvas: HTMLCanvasElement, private options: CalamusOptions = {}) {
    this.width = options.width ?? PAPER.width;
    this.height = options.height ?? PAPER.height;
    if (![this.width, this.height].every(value => Number.isFinite(value) && value > 0)) {
      throw new RangeError('Canvas dimensions must be positive finite numbers.');
    }
    this.committedCanvas = canvas.ownerDocument.createElement('canvas');
    this.brush = { color: '#253631', size: 6, smoothing: 0.55, stabilizer: 0, velocityWidth: true };
    this.setBrush(options.brush ?? {});
    this.originalTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';
    const signal = this.controller.signal;
    canvas.addEventListener('pointerdown', this.begin, { signal });
    canvas.addEventListener('pointermove', this.move, { signal });
    canvas.addEventListener('pointerup', this.end, { signal });
    canvas.addEventListener('pointercancel', this.cancel, { signal });
    canvas.addEventListener('lostpointercapture', this.cancel, { signal });
    window.addEventListener('blur', this.cancel, { signal });
    window.addEventListener('resize', this.resize, { signal });
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.watchResolution();
    this.resize();
  }

  setBrush(settings: Partial<Brush>): void {
    const next = { ...this.brush, ...settings };
    if (!Number.isFinite(next.size) || next.size <= 0) throw new RangeError('Brush size must be positive.');
    if (next.smoothing !== undefined && (!Number.isFinite(next.smoothing) || next.smoothing < 0 || next.smoothing > 1)) {
      throw new RangeError('Smoothing must be between zero and one.');
    }
    if (next.stabilizer !== undefined && (!Number.isFinite(next.stabilizer) || next.stabilizer < 0)) {
      throw new RangeError('Stabilizer radius must be nonnegative.');
    }
    this.brush = next;
  }

  setStrokes(strokes: Stroke[]): void {
    if (this.destroyed) throw new Error('Calamus has been destroyed.');
    const replacement = structuredClone(strokes);
    this.cancel();
    this.strokes = replacement;
    this.committedDirty = true;
    this.render();
  }

  private sample(event: PointerEvent): Point {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * this.width / bounds.width,
      y: (event.clientY - bounds.top) * this.height / bounds.height,
      time: Math.max(0, event.timeStamp - (this.active?.start ?? event.timeStamp)),
      pressure: event.pointerType === 'pen' ? event.pressure : null,
    };
  }

  private begin = (event: PointerEvent): void => {
    if (this.active || event.button !== 0 || !event.isPrimary) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.active = {
      id: event.pointerId, start: event.timeStamp,
      stroke: { brush: { ...this.brush }, points: [this.sample(event)] },
    };
    this.schedule();
  };

  private move = (event: PointerEvent): void => {
    if (this.active?.id !== event.pointerId) return;
    const samples = event.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length ? samples : [event]) this.active.stroke.points.push(this.sample(sample));
    this.schedule();
  };

  private end = (event: PointerEvent): void => {
    if (this.active?.id !== event.pointerId) return;
    const stroke = this.active.stroke;
    const last = stroke.points[stroke.points.length - 1];
    const end = this.sample(event);
    if (end.x !== last.x || end.y !== last.y) {
      stroke.points.push({ ...end, pressure: last.pressure });
    }
    this.active = null;
    this.strokes.push(stroke);
    this.committedDirty = true;
    this.render();
    this.options.onStroke?.(structuredClone(stroke));
  };

  private cancel = (event?: Event): void => {
    if (event instanceof PointerEvent && event.pointerId !== this.active?.id) return;
    const id = this.active?.id;
    this.active = null;
    if (id !== undefined && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    this.schedule();
  };

  private watchResolution = (): void => {
    this.resolutionQuery?.removeEventListener('change', this.watchResolution);
    if (this.destroyed) return;
    this.resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.resolutionQuery.addEventListener('change', this.watchResolution);
    this.resize();
  };

  private resize = (): void => {
    if (this.destroyed) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width === width && this.canvas.height === height &&
        this.committedCanvas.width === width && this.committedCanvas.height === height) return;
    this.canvas.width = this.committedCanvas.width = width;
    this.canvas.height = this.committedCanvas.height = height;
    this.committedDirty = true;
    this.render();
  };

  private schedule(): void {
    if (this.frame || this.destroyed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  private render(): void {
    if (this.destroyed) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (this.committedDirty) {
      const cached = this.committedCanvas.getContext('2d');
      if (!cached) return;
      cached.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
      cached.clearRect(0, 0, this.width, this.height);
      for (const stroke of this.strokes) drawStroke(cached, stroke);
      this.committedDirty = false;
    }
    ctx.drawImage(this.committedCanvas, 0, 0, this.width, this.height);
    if (this.active) drawStroke(ctx, this.active.stroke);
  }

  destroy(): void {
    this.destroyed = true;
    this.controller.abort();
    this.observer.disconnect();
    this.resolutionQuery?.removeEventListener('change', this.watchResolution);
    this.cancel();
    cancelAnimationFrame(this.frame);
    this.canvas.style.touchAction = this.originalTouchAction;
  }
}
