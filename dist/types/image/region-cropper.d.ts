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
export declare function isValidRegion(r: Region): boolean;
export declare function cropRegion(source: HTMLCanvasElement, region: Region, options?: CropOptions): HTMLCanvasElement;
