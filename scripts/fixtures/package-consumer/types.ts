import { Calamus, createSVG, processStroke, type Stroke, type CalamusOptions, type CalamusDocument } from '@calamus/core';
const options: CalamusOptions = { width: 1000, height: 700, brush: { size: 6 }, onReplayChange: state => {
  const valid: 'idle' | 'playing' | 'paused' = state;
  void valid;
} };
const stroke: Stroke = { brush: { color: '#123456', size: 6 }, points: [{ x: 1, y: 2, time: 0, pressure: null }] };
const data: CalamusDocument = { schemaVersion: 1, width: 1000, height: 700, strokes: [stroke] };
const svg: string = createSVG(data.strokes, data.width, data.height);
const width: number = processStroke(stroke)[0].width;
function mount(canvas: HTMLCanvasElement) {
  const engine = new Calamus(canvas, options);
  engine.setTool('eraser');
  engine.setStrokes(data.strokes);
  const png: Promise<Blob> = engine.exportPNG({ scale: 2 });
  // @ts-expect-error Unsupported tools must be rejected by the public declarations.
  engine.setTool('unknown');
  // @ts-expect-error Brush size must be numeric.
  engine.setBrush({ size: 'large' });
  engine.destroy();
  return png;
}
void [svg, width, mount];
