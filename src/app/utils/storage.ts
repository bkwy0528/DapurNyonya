export function safeGetJSON(key: string, fallback: any) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`safeGetJSON: failed to parse localStorage[${key}]`, e);
    return fallback;
  }
}
