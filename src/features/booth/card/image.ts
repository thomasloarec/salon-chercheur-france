const MAX_SIDE = 1280;

async function decode(file: File): Promise<{ src: CanvasImageSource; w: number; h: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { src: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() };
    } catch {
      // repli sur Image
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('BOOTH_IMAGE_UNREADABLE'));
      i.src = url;
    });
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('BOOTH_IMAGE_UNREADABLE');
  }
}

/** Redimensionne la photo sur l'appareil (1 280 px max) et la convertit en JPEG base64. */
export async function prepareCardImage(file: File): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  const { src, w, h, release } = await decode(file);
  const canvas = document.createElement('canvas');
  try {
    if (!w || !h) throw new Error('BOOTH_IMAGE_UNREADABLE');
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('BOOTH_IMAGE_UNREADABLE');
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64 = dataUrl.split(',')[1] ?? '';
    if (!base64) throw new Error('BOOTH_IMAGE_UNREADABLE');
    return { base64, mediaType: 'image/jpeg' };
  } finally {
    release();
    canvas.width = 0;
    canvas.height = 0;
  }
}
