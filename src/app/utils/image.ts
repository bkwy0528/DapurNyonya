// Images are stored as base64 strings inside Firestore documents, which are
// capped at 1 MiB — so every upload must be resized/compressed below that
// before saving, or the write fails with an unhelpful error.

const MAX_DIMENSION = 1200;
const TARGET_MAX_BYTES = 500 * 1024; // leaves room for the rest of the document

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image file')); };
    img.src = url;
  });
}

// base64 length ≈ bytes × 4/3, so compare against the encoded string directly
function base64Bytes(dataUrl: string): number {
  return Math.ceil((dataUrl.length * 3) / 4);
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

  let dataUrl = '';
  for (const quality of [0.8, 0.6, 0.4, 0.25]) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (base64Bytes(dataUrl) <= TARGET_MAX_BYTES) return dataUrl;
  }
  throw new Error('Image is too large even after compression. Please use a smaller photo.');
}
