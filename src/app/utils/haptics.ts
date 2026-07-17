// The Vibration API is Android-only — iOS Safari has never implemented it —
// so every call here is a silent no-op on iPhones. Pure progressive
// enhancement, never something a flow can depend on.
export function vibrate(pattern: number | number[] = 15) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
