export type Preferences = { theme: 'light' | 'dark'; paperColor: '#fffdf7' | '#ffffff' | '#e9f0e8'; guides: 'plain' | 'dots'; drawingOrder: 'recent' | 'name' };
export const defaultPreferences: Preferences = { theme: 'light', paperColor: '#fffdf7', guides: 'dots', drawingOrder: 'recent' };
export function parsePreferences(value: string | null): Preferences {
  try {
    const data = JSON.parse(value ?? '{}');
    return {
      drawingOrder: data?.drawingOrder === 'name' ? 'name' : 'recent',
      theme: data?.theme === 'dark' ? 'dark' : 'light',
      paperColor: ['#fffdf7', '#ffffff', '#e9f0e8'].includes(data?.paperColor) ? data.paperColor : '#fffdf7',
      guides: data?.guides === 'plain' ? 'plain' : 'dots',
    };
  } catch { return { ...defaultPreferences }; }
}
export function brushColor(color: string, mode: 'pen' | 'highlighter'): string {
  return mode === 'highlighter' ? `${color}66` : color;
}
