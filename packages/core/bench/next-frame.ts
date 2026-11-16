/** A diagnostic frame wait must settle even when a background tab stops receiving frames. */
export function nextFrame(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Measurement cancelled.')); return; }
    let id = 0;
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const abort = () => { cancelAnimationFrame(id); cleanup(); reject(new Error('Measurement cancelled.')); };
    const timer = setTimeout(() => { cancelAnimationFrame(id); cleanup(); reject(new Error('Frame scheduling stalled.')); }, 5000);
    id = requestAnimationFrame(() => { cleanup(); resolve(); });
    signal.addEventListener('abort', abort, { once: true });
  });
}
