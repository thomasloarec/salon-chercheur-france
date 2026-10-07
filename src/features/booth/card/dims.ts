/** Lit les dimensions d'une image (JPEG ou PNG) depuis son en-tête, sans la décoder. Orientation EXIF prise en compte. */
export async function readImageSize(file: Blob): Promise<{ w: number; h: number } | null> {
  try {
    const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (buf.byteLength >= 24 && buf.getUint32(0) === 0x89504e47) {
      return { w: buf.getUint32(16), h: buf.getUint32(20) };
    }
    if (buf.byteLength < 4 || buf.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    let orientation = 1;
    while (off + 4 <= buf.byteLength) {
      if (buf.getUint8(off) !== 0xff) return null;
      const marker = buf.getUint8(off + 1);
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        off += 2;
        continue;
      }
      const len = buf.getUint16(off + 2);
      if (marker === 0xe1 && off + 10 <= buf.byteLength && buf.getUint32(off + 4) === 0x45786966) {
        orientation = readOrientation(buf, off + 10, Math.min(buf.byteLength, off + 2 + len)) ?? orientation;
      }
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof && off + 9 <= buf.byteLength) {
        const h = buf.getUint16(off + 5);
        const w = buf.getUint16(off + 7);
        if (!w || !h) return null;
        return orientation >= 5 && orientation <= 8 ? { w: h, h: w } : { w, h };
      }
      off += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
}

function readOrientation(v: DataView, tiff: number, end: number): number | null {
  if (tiff + 8 > end) return null;
  const le = v.getUint16(tiff) === 0x4949;
  const ifd = tiff + v.getUint32(tiff + 4, le);
  if (ifd + 2 > end) return null;
  const n = v.getUint16(ifd, le);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > end) return null;
    if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le);
  }
  return null;
}
