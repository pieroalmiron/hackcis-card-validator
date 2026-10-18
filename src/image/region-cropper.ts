import type { Region } from "../ocr/regions";

export interface CropOptions {
  /** Margen relativo a la imagen (ej. 0.004 = 0.4 % del ancho). */
  marginX?: number;
  marginY?: number;
  /** Altura mínima en píxeles; si el recorte es menor se amplía. */
  targetHeightPx?: number;
  maxScale?: number;
  /** Borde blanco alrededor del recorte (Tesseract rinde mejor con aire alrededor). */
  padPx?: number;
  invert?: boolean;
  /** Estiramiento lineal de contraste (percentiles 2–98). */
  stretch?: boolean;
  /** Binarización de Otsu (se aplica después del estiramiento). */
  binarize?: boolean;
  /** Engrosa trazos oscuros N píxeles (solo tiene sentido tras binarizar). */
  thicken?: number;
}

export function isValidRegion(r: Region): boolean {
  const finite = [r.x, r.y, r.width, r.height].every(Number.isFinite);
  return (
    finite &&
    r.x >= 0 && r.y >= 0 &&
    r.width > 0 && r.height > 0 &&
    r.x + r.width <= 1 + 1e-9 &&
    r.y + r.height <= 1 + 1e-9
  );
}

function luminance(d: Uint8ClampedArray, i: number): number {
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}

function stretchContrast(d: Uint8ClampedArray): void {
  const hist = new Uint32Array(256);
  const total = d.length / 4;
  for (let i = 0; i < d.length; i += 4) hist[Math.round(luminance(d, i))]++;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total * 0.02) { lo = v; break; }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= total * 0.02) { hi = v; break; }
  }
  if (hi - lo < 16) return; // casi sin contraste: no amplificar ruido
  const k = 255 / (hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      d[i + c] = Math.min(255, Math.max(0, (d[i + c] - lo) * k));
    }
  }
}

function otsuThreshold(d: Uint8ClampedArray): number {
  const hist = new Uint32Array(256);
  const total = d.length / 4;
  for (let i = 0; i < d.length; i += 4) hist[Math.round(luminance(d, i))]++;
  let sumAll = 0;
  for (let v = 0; v < 256; v++) sumAll += v * hist[v];
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > bestVar) { bestVar = between; best = t; }
  }
  return best;
}

function binarizePixels(d: Uint8ClampedArray): void {
  const t = otsuThreshold(d);
  for (let i = 0; i < d.length; i += 4) {
    const v = luminance(d, i) <= t ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
}

/** Dilatación de los trazos oscuros (filtro mínimo separable). */
function thickenDark(d: Uint8ClampedArray, w: number, h: number, r: number): void {
  if (r < 1) return;
  const g = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) g[p] = d[p * 4];
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 255;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) {
        m = Math.min(m, g[y * w + k]);
      }
      tmp[y * w + x] = m;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 255;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) {
        m = Math.min(m, tmp[k * w + x]);
      }
      g[y * w + x] = m;
    }
  }
  for (let p = 0; p < w * h; p++) {
    d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = g[p];
  }
}

export function cropRegion(
  source: HTMLCanvasElement,
  region: Region,
  options: CropOptions = {},
): HTMLCanvasElement {
  if (!isValidRegion(region)) {
    throw new RangeError(`Región inválida: ${JSON.stringify(region)}`);
  }
  const {
    marginX = 0.004,
    marginY = 0.004,
    targetHeightPx = 64,
    maxScale = 4,
    padPx = 10,
    invert = false,
    stretch = false,
    binarize = false,
    thicken = 0,
  } = options;

  const x0 = Math.max(0, region.x - marginX);
  const y0 = Math.max(0, region.y - marginY);
  const x1 = Math.min(1, region.x + region.width + marginX);
  const y1 = Math.min(1, region.y + region.height + marginY);

  const sx = Math.floor(x0 * source.width);
  const sy = Math.floor(y0 * source.height);
  const sw = Math.ceil(x1 * source.width) - sx;
  const sh = Math.ceil(y1 * source.height) - sy;

  if (sw < 1 || sh < 1) {
    throw new RangeError("El recorte resultante tiene dimensiones vacías.");
  }

  // Solo se amplía (nunca se reduce) y con límite.
  const scale = Math.min(maxScale, Math.max(1, targetHeightPx / sh));
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));

  const out = document.createElement("canvas");
  out.width = dw + padPx * 2;
  out.height = dh + padPx * 2;
  const needsPixels = invert || stretch || binarize || thicken > 0;
  const ctx = out.getContext("2d", { willReadFrequently: needsPixels });
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, sw, sh, padPx, padPx, dw, dh);

  if (needsPixels) {
    const img = ctx.getImageData(padPx, padPx, dw, dh);
    const d = img.data;
    if (stretch) stretchContrast(d);
    if (binarize) binarizePixels(d);
    if (thicken > 0) thickenDark(d, dw, dh, thicken);
    if (invert) {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
    }
    ctx.putImageData(img, padPx, padPx);
  }

  return out;
}