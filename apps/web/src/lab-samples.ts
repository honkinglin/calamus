import type { Point } from '@calamus/core';
export type SampleKind = 'wave' | 'corners' | 'pressure';

/** Deterministic document-space samples; never reads pointer input or clock time. */
export function makeLabSample(kind: SampleKind): Point[] {
  return Array.from({ length: 121 }, (_, index) => {
    const t = index / 120;
    const phase = t * 4;
    const triangle = 1 - 4 * Math.abs(Math.round(phase) - phase);
    return {
      x: 35 + t * 410,
      y: 120 + (kind === 'corners' ? triangle * 65 : Math.sin(t * Math.PI * 4) * 55 + Math.sin(index * 2.3) * 3),
      time: index * 8,
      pressure: kind === 'pressure' ? 0.1 + 0.8 * Math.sin(t * Math.PI) ** 2 : null,
    };
  });
}
