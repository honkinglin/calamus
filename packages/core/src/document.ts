import type { Brush, Stroke } from './index.js';

export interface CalamusDocument {
  schemaVersion: 1;
  width: number;
  height: number;
  strokes: Stroke[];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected an object.');
  return value as Record<string, unknown>;
}

function number(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new TypeError('Invalid numeric value in document.');
  }
  return value;
}

/** Validate and copy only supported fields before changing the live document. */
export function parseDocument(input: string): CalamusDocument {
  if (input.length > 20_000_000) throw new RangeError('Document exceeds 20 MB.');
  return validateDocument(JSON.parse(input));
}

export function validateDocument(input: unknown): CalamusDocument {
  const data = record(input);
  if (data.schemaVersion !== 1) throw new TypeError('Unsupported document version.');
  const width = number(data.width, 1, 32768);
  const height = number(data.height, 1, 32768);
  if (!Array.isArray(data.strokes) || data.strokes.length > 10000) throw new RangeError('Invalid stroke count.');
  let count = 0;
  const strokes = data.strokes.map(value => {
    const stroke = record(value);
    const brush = validateBrush(stroke.brush);
    if (!Array.isArray(stroke.points) || stroke.points.length === 0) throw new TypeError('Stroke has no points.');
    count += stroke.points.length;
    if (count > 250000) throw new RangeError('Document contains too many points.');
    let previousTime = 0;
    const points = stroke.points.map(value => {
      const point = record(value);
      const time = number(point.time, previousTime, 86400000);
      previousTime = time;
      return {
        x: number(point.x, -1000000, 1000000),
        y: number(point.y, -1000000, 1000000),
        time,
        pressure: point.pressure === null ? null : number(point.pressure, 0, 1),
      };
    });
    return {
      brush,
      points,
    };
  });
  return { schemaVersion: 1, width, height, strokes };
}

/** Shared persisted/live brush contract. Callers merge their defaults before validation. */
export function validateBrush(input: unknown): Brush {
  const brush = record(input);
  if (typeof brush.color !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(brush.color)) {
    throw new TypeError('Brush colors must use hexadecimal notation.');
  }
  if (brush.velocityWidth !== undefined && typeof brush.velocityWidth !== 'boolean') {
    throw new TypeError('Invalid velocity width setting.');
  }
  return {
    color: brush.color,
    size: number(brush.size, 0.01, 4096),
    smoothing: number(brush.smoothing ?? 0, 0, 1),
    stabilizer: number(brush.stabilizer ?? 0, 0, 4096),
    velocityWidth: brush.velocityWidth as boolean | undefined,
  };
}
