/** Longest side used to find the margins, and the most a stored logo keeps. */
const MAX_SIDE = 800;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Cuts the empty margin around a logo (a plain or transparent background) so the artwork
 * fills the space it is given on documents. Returns the original when nothing can be cut.
 */
export async function trimLogo(dataUrl: string): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // The background is what the four corners share.
    const at = (x: number, y: number) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
    const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
    const bg = [0, 1, 2, 3].map((k) => corners.reduce((sum, c) => sum + c[k], 0) / 4);
    const transparentBg = bg[3] < 20;
    const differs = (i: number) => {
      if (transparentBg) return data[i + 3] > 40;
      if (data[i + 3] < 20) return false;
      return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 60;
    };

    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (differs((y * w + x) * 4)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return dataUrl;

    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
    const x0 = Math.max(0, minX - pad);
    const y0 = Math.max(0, minY - pad);
    const cw = Math.min(w, maxX + pad + 1) - x0;
    const ch = Math.min(h, maxY + pad + 1) - y0;
    // Under a tenth smaller on both sides: nothing worth cutting.
    if (cw > w * 0.9 && ch > h * 0.9 && scale === 1) return dataUrl;

    // Cut from the full-size original so the kept artwork stays sharp, then cap its size.
    const sx = x0 / scale, sy = y0 / scale, sw = cw / scale, sh = ch / scale;
    const outScale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(sw * outScale));
    out.height = Math.max(1, Math.round(sh * outScale));
    const octx = out.getContext('2d');
    if (!octx) return dataUrl;
    octx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return transparentBg || dataUrl.startsWith('data:image/png') ? out.toDataURL('image/png') : out.toDataURL('image/jpeg', 0.92);
  } catch {
    return dataUrl;
  }
}
