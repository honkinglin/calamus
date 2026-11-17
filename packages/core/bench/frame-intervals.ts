/** Observed rAF spacing, not render duration or input latency. */
export function frameIntervals(timestamps: readonly number[]) {
  if (timestamps.some((time, index) => !Number.isFinite(time) || (index > 0 && time < timestamps[index - 1]!))) {
    throw new Error('Expected finite, monotonic frame timestamps.');
  }
  const samplesMs = timestamps.slice(1).map((time,index) => time-timestamps[index]!);
  const sorted = [...samplesMs].sort((a,b) => a-b);
  const middle = Math.floor(sorted.length/2);
  return {
    count: samplesMs.length,
    samplesMs,
    medianMs: sorted.length ? sorted.length%2 ? sorted[middle]! : (sorted[middle-1]!+sorted[middle]!)/2 : null,
    p95Ms: sorted.length ? sorted[Math.ceil(sorted.length*0.95)-1]! : null,
    maxMs: sorted.at(-1) ?? null,
  };
}
