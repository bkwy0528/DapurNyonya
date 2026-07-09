import type { SyntheticEvent } from 'react';

// Neutral inline-SVG placeholder shown when a product photo URL is broken —
// the browser's default broken-image icon reads as a bug to customers.
const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect width="100" height="100" fill="#f3f4f6"/>' +
      '<g fill="none" stroke="#d1d5db" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="24" y="30" width="52" height="40" rx="5"/>' +
      '<circle cx="40" cy="44" r="5"/>' +
      '<path d="M30 64l13-13 9 9 11-11 13 13"/>' +
      '</g>' +
      '</svg>'
  );

export function onImageError(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  // Guard against an error loop if the placeholder itself ever fails to render.
  if (img.src === PLACEHOLDER) return;
  img.src = PLACEHOLDER;
}
