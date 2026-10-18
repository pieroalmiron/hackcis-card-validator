
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

const DEFAULT_OPTIONS: Required<ImagePreprocessorOptions> = {
  grayscale: true,
  contrast: 1.2,
  maxDimension: 2000,
};

export function preprocessImage(
  loaded: LoadedImage,
  options: ImagePreprocessorOptions = {},
): ProcessedImage {
  const config = { ...DEFAULT_OPTIONS, ...options };

  if (!Number.isFinite(config.contrast) || config.contrast <= 0) {
    throw new RangeError("El contraste debe ser mayor que cero.");
  }

  if (
    !Number.isFinite(config.maxDimension) ||
    config.maxDimension < 1
  ) {
    throw new RangeError("maxDimension debe ser mayor que cero.");
  }

  const { image, width: sourceWidth, height: sourceHeight } = loaded;

  const scale = Math.min(
    1,
    config.maxDimension / Math.max(sourceWidth, sourceHeight),
  );

  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!context) {
    throw new Error("No se pudo crear el contexto de imagen.");
  }

  context.drawImage(image, 0, 0, width, height);

  if (config.grayscale || config.contrast !== 1) {
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      let red = pixels[i];
      let green = pixels[i + 1];
      let blue = pixels[i + 2];

      if (config.grayscale) {
        const gray = 0.299 * red + 0.587 * green + 0.114 * blue;
        red = gray;
        green = gray;
        blue = gray;
      }

      pixels[i] = clamp((red - 128) * config.contrast + 128);
      pixels[i + 1] = clamp((green - 128) * config.contrast + 128);
      pixels[i + 2] = clamp((blue - 128) * config.contrast + 128);
    }

    context.putImageData(imageData, 0, 0);
  }

  return { canvas, width, height };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
