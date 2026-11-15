/** Produce a portable filename while keeping Unicode drawing names readable. */
export function exportFilename(name: string | undefined, format: 'png' | 'svg' | 'json'): string {
  const cleaned = (name ?? '').normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '-')
    .trim().replace(/^\.+|[. ]+$/g, '');
  // Keep below common filesystem byte limits, including multi-byte Unicode names.
  let stem = '';
  const encoder = new TextEncoder();
  for (const point of cleaned) {
    if (encoder.encode(stem + point).length > 180) break;
    stem += point;
  }
  stem = stem.replace(/[. ]+$/g, '') || 'calamus';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = `_${stem}`;
  return `${stem}.${format}`;
}
