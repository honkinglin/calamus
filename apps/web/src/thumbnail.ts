import { drawStroke, parseDocument } from '@calamus/core';

/** Render a bounded-size preview with the same geometry as the drawing canvas. */
export function createThumbnail(json: string): string | undefined {
  try {
    const drawing = parseDocument(json);
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 112;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#fffdf7';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / drawing.width, canvas.height / drawing.height);
    context.translate((canvas.width - drawing.width * scale) / 2, (canvas.height - drawing.height * scale) / 2);
    context.scale(scale, scale);
    for (const stroke of drawing.strokes) drawStroke(context, stroke);
    return canvas.toDataURL('image/png');
  } catch {
    return undefined;
  }
}
