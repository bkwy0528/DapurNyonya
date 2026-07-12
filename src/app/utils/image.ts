// Images are stored as base64 strings inside Firestore documents, which are
// capped at 1 MiB — so every upload must be resized/compressed below that
// before saving, or the write fails with an unhelpful error.

const MAX_DIMENSION = 1200;
const TARGET_MAX_BYTES = 500 * 1024; // leaves room for the rest of the document

// All product photos are cropped and displayed at this ratio so pictures taken
// on different phones look consistent across the catalogue.
export const PRODUCT_IMAGE_ASPECT = 4 / 3;

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return loadImageFromSrc(url).finally(() => URL.revokeObjectURL(url));
}

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image file'));
    img.src = src;
  });
}

// base64 length ≈ bytes × 4/3, so compare against the encoded string directly
function base64Bytes(dataUrl: string): number {
  return Math.ceil((dataUrl.length * 3) / 4);
}

function canvasToCompressedDataUrl(canvas: HTMLCanvasElement): string {
  let dataUrl = '';
  for (const quality of [0.8, 0.6, 0.4, 0.25]) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (base64Bytes(dataUrl) <= TARGET_MAX_BYTES) return dataUrl;
  }
  throw new Error('Image is too large even after compression. Please use a smaller photo.');
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

export async function compressImage(file: File): Promise<string> {
  const img = await loadImage(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvasToCompressedDataUrl(canvas);
}

// Cuts the selected region out of the source image (a data: URL from
// fileToDataUrl or a previously stored product image) and compresses it like
// compressImage does. The crop rectangle comes from react-easy-crop in source
// pixels; the output is downscaled to MAX_DIMENSION but never upscaled.
export async function cropImageToDataUrl(
  src: string,
  crop: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const img = await loadImageFromSrc(src);

  const outWidth = Math.round(Math.min(crop.width, MAX_DIMENSION));
  const outHeight = Math.round(outWidth * (crop.height / crop.width));
  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, outWidth, outHeight);

  return canvasToCompressedDataUrl(canvas);
}
