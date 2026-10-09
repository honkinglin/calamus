import { exportBounds } from './bounds.js';
import type { CropOptions } from './bounds.js';
import { hitsStrokeSweep } from './hit-test.js';
import { replayDuration, replayFrame } from './replay.js';
import { createSVG } from './export.js';
import { parseDocument } from './document.js';
import { drawStroke, PAPER } from './index.js';
import type { Brush, Point, Stroke } from './index.js';

export interface CalamusOptions {
  width?: number;
  height?: number;
  brush?: Partial<Brush>;
  onStroke?: (stroke: Stroke) => void;
  onChange?: (state: HistoryState) => void;
  onReplayChange?: (state: ReplayState) => void;
}

export interface PNGExportOptions extends CropOptions {
  scale?: number;
  background?: string;
}

export type ReplayState = 'idle' | 'playing' | 'paused';

export interface HistoryState {
  strokes: number;
  undo: number;
  redo: number;
}

/** Owns pointer input and renders strokes in document coordinates. */
export class Calamus {
  private tool: 'pen' | 'eraser' = 'pen';
  private erased = new Set<Stroke>();
  private strokes: Stroke[] = [];
  private playback: { elapsed: number; previous: number | null; paused: boolean; speed: number } | null = null;
  private playbackFrame = 0;
  private past: Stroke[][] = [];
  private future: Stroke[][] = [];
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

  setTool(tool: 'pen' | 'eraser'): void {
    this.assertAlive();
    if (tool !== 'pen' && tool !== 'eraser') throw new TypeError('Unknown tool.');
    this.cancel();
    this.tool = tool;
  }

  private eraseAt(point: Point, previous: Point = point): void {
    for (const stroke of this.strokes) {
      if (!this.erased.has(stroke) && hitsStrokeSweep(stroke, previous, point, 10)) this.erased.add(stroke);
    }
    this.committedDirty = true;
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

  play(options: { speed?: number } = {}): void {
    this.assertAlive();
    const speed = options.speed ?? 1;
    if (!Number.isFinite(speed) || speed < 0.25 || speed > 4) {
      throw new RangeError('Replay speed must be between 0.25 and 4.');
    }
    this.cancel();
    this.stopReplay();
    if (!this.strokes.length) return;
    this.playback = { elapsed: 0, previous: null, paused: false, speed };
    this.playbackFrame = requestAnimationFrame(this.tickReplay);
    this.options.onReplayChange?.('playing');
  }

  pauseReplay(): void {
    if (!this.playback || this.playback.paused) return;
    this.playback.paused = true;
    this.playback.previous = null;
    cancelAnimationFrame(this.playbackFrame);
    this.options.onReplayChange?.('paused');
  }

  resumeReplay(): void {
    if (!this.playback?.paused) return;
    this.playback.paused = false;
    this.playbackFrame = requestAnimationFrame(this.tickReplay);
    this.options.onReplayChange?.('playing');
  }

  stopReplay(): void {
    if (!this.playback) return;
    cancelAnimationFrame(this.playbackFrame);
    this.playback = null;
    this.render();
    this.options.onReplayChange?.('idle');
  }

  private tickReplay = (time: number): void => {
    const playback = this.playback;
    if (!playback || playback.paused || this.destroyed) return;
    if (playback.previous !== null) playback.elapsed += (time - playback.previous) * playback.speed;
    playback.previous = time;
    if (playback.elapsed >= replayDuration(this.strokes)) {
      this.stopReplay();
      return;
    }
    this.render();
    this.playbackFrame = requestAnimationFrame(this.tickReplay);
  };

  get state(): HistoryState {
    return { strokes: this.strokes.length, undo: this.past.length, redo: this.future.length };
  }

  exportPNG(options: PNGExportOptions = {}): Promise<Blob> {
    this.assertAlive();
    const scale = options.scale ?? 1;
    if (!Number.isFinite(scale) || scale <= 0 || scale > 4) {
      throw new RangeError('PNG scale must be greater than zero and at most four.');
    }
    const bounds = exportBounds(this.strokes, this.width, this.height, options);
    const width = Math.ceil(bounds.width * scale);
    const height = Math.ceil(bounds.height * scale);
    if (width * height > 32_000_000 || width > 16384 || height > 16384) {
      throw new RangeError('PNG output exceeds the supported pixel limit.');
    }
    const canvas = this.canvas.ownerDocument.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    context.setTransform(width / bounds.width, 0, 0, height / bounds.height,
      -bounds.x * width / bounds.width, -bounds.y * height / bounds.height);
    if (options.background !== undefined) {
      context.fillStyle = options.background;
      context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    for (const stroke of this.strokes) drawStroke(context, stroke);
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Unable to encode PNG.'));
      }, 'image/png');
    });
  }

  exportSVG(options: CropOptions = {}): string {
    this.assertAlive();
    return createSVG(this.strokes, this.width, this.height, options);
  }

  exportJSON(): string {
    this.assertAlive();
    return JSON.stringify({ schemaVersion: 1, width: this.width, height: this.height, strokes: this.strokes });
  }

  loadJSON(json: string): void {
    this.assertAlive();
    const document = parseDocument(json);
    if (document.width !== this.width || document.height !== this.height) {
      throw new RangeError('Document dimensions must match this canvas.');
    }
    this.setStrokes(document.strokes);
  }

  getStrokes(): Stroke[] {
    return structuredClone(this.strokes);
  }

  setStrokes(strokes: Stroke[]): void {
    this.assertAlive();
    const replacement = structuredClone(strokes);
    this.stopReplay();
    this.cancel();
    this.commit(replacement);
  }

  clear(): void {
    this.assertAlive();
    this.stopReplay();
    this.cancel();
    if (this.strokes.length) this.commit([]);
  }

  undo(): void {
    this.restore(this.past, this.future);
  }

  redo(): void {
    this.restore(this.future, this.past);
  }

  private assertAlive(): void {
    if (this.destroyed) throw new Error('Calamus has been destroyed.');
  }

  private commit(strokes: Stroke[]): void {
    this.past.push(this.strokes);
    this.future = [];
    this.strokes = strokes;
    this.changed();
  }

  private restore(source: Stroke[][], destination: Stroke[][]): void {
    this.assertAlive();
    this.stopReplay();
    this.cancel();
    const strokes = source.pop();
    if (!strokes) return;
    destination.push(this.strokes);
    this.strokes = strokes;
    this.changed();
  }

  private changed(): void {
    this.committedDirty = true;
    this.render();
    this.options.onChange?.(this.state);
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
    if (this.playback || this.active || event.button !== 0 || !event.isPrimary) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.active = {
      id: event.pointerId, start: event.timeStamp,
      stroke: { brush: { ...this.brush }, points: [this.sample(event)] },
    };
    if (this.tool === 'eraser') this.eraseAt(this.active.stroke.points[0]);
    this.schedule();
  };

  private move = (event: PointerEvent): void => {
    if (this.active?.id !== event.pointerId) return;
    const samples = event.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length ? samples : [event]) {
      const point = this.sample(sample);
      const previous = this.active.stroke.points.at(-1)!;
      this.active.stroke.points.push(point);
      if (this.tool === 'eraser') this.eraseAt(point, previous);
    }
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
    if (this.tool === 'eraser') {
      this.eraseAt(end, last);
      const remaining = this.strokes.filter(item => !this.erased.has(item));
      this.erased.clear();
      if (remaining.length !== this.strokes.length) this.commit(remaining);
      else this.render();
      return;
    }
    this.commit([...this.strokes, stroke]);
    this.options.onStroke?.(structuredClone(stroke));
  };

  private cancel = (event?: Event): void => {
    if (event instanceof PointerEvent && event.pointerId !== this.active?.id) return;
    if (this.erased.size) {
      this.erased.clear();
      this.committedDirty = true;
    }
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
    if (this.playback) {
      for (const stroke of replayFrame(this.strokes, this.playback.elapsed)) drawStroke(ctx, stroke);
      return;
    }
    if (this.committedDirty) {
      const cached = this.committedCanvas.getContext('2d');
      if (!cached) return;
      cached.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
      cached.clearRect(0, 0, this.width, this.height);
      for (const stroke of this.strokes) {
        if (!this.erased.has(stroke)) drawStroke(cached, stroke);
      }
      this.committedDirty = false;
    }
    ctx.drawImage(this.committedCanvas, 0, 0, this.width, this.height);
    if (this.active && this.tool === 'pen') drawStroke(ctx, this.active.stroke);
  }

  destroy(): void {
    this.destroyed = true;
    this.stopReplay();
    this.controller.abort();
    this.observer.disconnect();
    this.resolutionQuery?.removeEventListener('change', this.watchResolution);
    this.cancel();
    cancelAnimationFrame(this.frame);
    this.canvas.style.touchAction = this.originalTouchAction;
  }
}
