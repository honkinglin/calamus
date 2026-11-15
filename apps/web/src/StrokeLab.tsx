import { useEffect, useMemo, useRef, useState } from 'react';
import { createStrokeGeometry, processStroke } from '@calamus/core';
import type { Point, Stroke } from '@calamus/core';
import { Icon } from './Icon';
import { BrowserBenchmark } from './BrowserBenchmark';
import { makeLabSample } from './lab-samples';
import type { SampleKind } from './lab-samples';

function LabPreview({ title, points, smoothing, radius, showRaw, showGuide }: {
  title: string; points: Point[]; smoothing: number; radius: number; showRaw: boolean; showGuide: boolean;
}) {
  const result = useMemo(() => {
    const stroke: Stroke = { points, brush: { color: '#254e43', size: 10, smoothing, stabilizer: radius, velocityWidth: false } };
    const processed = processStroke(stroke);
    const path = createStrokeGeometry(stroke).map(polygon => polygon.map((point, index) =>
      `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ') + 'Z').join(' ');
    return { path, tip: processed.at(-1)!, input: points.at(-1)! };
  }, [points, smoothing, radius]);
  return <figure className="lab-preview">
    <figcaption>{title}</figcaption>
    <svg viewBox="0 0 480 240" role="img" aria-label={`${title}: processed stroke and optional input guides`}>
      <path d={result.path} fill="#254e43" fillRule="nonzero" />
      {showRaw && <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#b85c4c" strokeWidth="1.5" strokeDasharray="4 3" />}
      {showGuide && <>
        {radius > 0 && <circle cx={result.input.x} cy={result.input.y} r={radius} fill="none" stroke="#5f6aab" strokeDasharray="4 3" />}
        <line x1={result.input.x} y1={result.input.y} x2={result.tip.x} y2={result.tip.y} stroke="#5f6aab" />
        <circle cx={result.input.x} cy={result.input.y} r="4" fill="#b85c4c" />
        <circle cx={result.tip.x} cy={result.tip.y} r="4" fill="#fff" stroke="#254e43" strokeWidth="2" />
      </>}
    </svg>
    <p>Tip offset: {Math.hypot(result.tip.x - result.input.x, result.tip.y - result.input.y).toFixed(1)} px</p>
  </figure>;
}

export function StrokeLab({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const [sample, setSample] = useState<SampleKind>('wave');
  const [smoothing, setSmoothing] = useState(0.55);
  const [radius, setRadius] = useState(16);
  const [progress, setProgress] = useState(121);
  const [showRaw, setShowRaw] = useState(true);
  const [showGuide, setShowGuide] = useState(true);
  const points = useMemo(() => makeLabSample(sample).slice(0, progress), [sample, progress]);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onClose, 160);
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);
  function requestClose() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onClose();
    else setClosing(true);
  }
  return <dialog ref={dialog} className="stroke-lab" data-closing={closing || undefined} aria-labelledby="lab-title"
    onCancel={event => { event.preventDefault(); requestClose(); }}>
    <div className="panel-heading"><h2 id="lab-title">Stroke lab</h2><button className="icon-button lab-close" aria-label="Close stroke lab" title="Close stroke lab (Esc)" onClick={requestClose} autoFocus><Icon name="close" /></button></div>
    <div className="lab-body">
    <p>Compare the same fixed sample. Experiments never change your drawing or exports.</p>
    <div className="lab-controls">
      <label>Sample <select value={sample} onChange={event => setSample(event.currentTarget.value as SampleKind)}>
        <option value="wave">Wavy line</option><option value="corners">Sharp corners</option><option value="pressure">Pressure ramp</option>
      </select></label>
      <label>Smoothing <output>{Math.round(smoothing * 100)}%</output><input type="range" min="0" max="1" step="0.05" value={smoothing} onChange={event => setSmoothing(Number(event.currentTarget.value))} /></label>
      <label>Follow radius <output>{radius} px</output><input type="range" min="0" max="32" value={radius} onChange={event => setRadius(Number(event.currentTarget.value))} /></label>
      <label>Sample position <output>{progress} / 121</output><input type="range" min="1" max="121" value={progress} onChange={event => setProgress(Number(event.currentTarget.value))} /></label>
    </div>
    <div className="actions">
      <label><input type="checkbox" checked={showRaw} onChange={event => setShowRaw(event.currentTarget.checked)} /> Raw input</label>
      <label><input type="checkbox" checked={showGuide} onChange={event => setShowGuide(event.currentTarget.checked)} /> Tip and radius guides</label>
    </div>
    <div className="lab-comparison">
      <LabPreview title="Adaptive smoothing" points={points} smoothing={smoothing} radius={0} showRaw={showRaw} showGuide={showGuide} />
      <LabPreview title="Radius following" points={points} smoothing={0} radius={radius} showRaw={showRaw} showGuide={showGuide} />
    </div>
    <p className="setting-note">Dashed red: raw input. White marker: processed tip. Purple circle: configured maximum radius; the engine ramps up its effective radius at the start. Pressure ramp uses synthetic pressure, not a device measurement. Offset is geometric distance, not latency.</p>
    <BrowserBenchmark />
    </div>
  </dialog>;
}
