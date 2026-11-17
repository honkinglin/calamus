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

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const preferenceKey = 'calamus-preferences';

// Resolve storage inside the guard: accessing localStorage itself can throw.
export function readPreferences(storage: () => PreferenceStorage): Preferences {
  try { return parsePreferences(storage().getItem(preferenceKey)); }
  catch { return { ...defaultPreferences }; }
}

export function savePreferences(preferences: Preferences, storage: () => PreferenceStorage): boolean {
  try {
    storage().setItem(preferenceKey, JSON.stringify(preferences));
    return true;
  } catch { return false; }
}
