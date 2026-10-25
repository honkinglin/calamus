export function clampZoom(value: number): number {
  return Number.isFinite(value) ? Math.min(3, Math.max(1, value)) : 1;
}

/** Preserve the document point under the viewport center as its CSS size changes. */
export function zoomScroll(offset: number, viewportSize: number, previous: number, next: number): number {
  return Math.max(0, (offset + viewportSize / 2) * next / previous - viewportSize / 2);
}
