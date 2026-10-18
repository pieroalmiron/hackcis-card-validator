import type { ProcessedImage } from "./image-preprocessor";

export function getCanvas(image: ProcessedImage): HTMLCanvasElement {
  return (image as unknown as { canvas: HTMLCanvasElement }).canvas;
}

export function canvasToProcessedImage(canvas: HTMLCanvasElement): ProcessedImage {
  return { canvas, width: canvas.width, height: canvas.height } as unknown as ProcessedImage;
}