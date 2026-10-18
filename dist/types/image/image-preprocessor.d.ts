import type { LoadedImage } from "./image-loader";
export interface ImagePreprocessorOptions {
    grayscale?: boolean;
    contrast?: number;
    maxDimension?: number;
}
export interface ProcessedImage {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
}
export declare function preprocessImage(loaded: LoadedImage, options?: ImagePreprocessorOptions): ProcessedImage;
