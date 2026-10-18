
export interface LoadedImage {
  image: HTMLImageElement;
  width: number;
  height: number;
  mimeType: string;
}

export interface ImageLoaderOptions {
  minWidth?: number;
  minHeight?: number;
  maxFileSizeMB?: number;
}

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const DEFAULT_OPTIONS: Required<ImageLoaderOptions> = {
  minWidth: 300,
  minHeight: 200,
  maxFileSizeMB: 15,
};

export async function loadImage(
  file: File,
  options: ImageLoaderOptions = {},
): Promise<LoadedImage> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    throw new Error(
      "El cargador de imágenes requiere un navegador.",
    );
  }

  if (!(file instanceof File)) {
    throw new TypeError("Debes proporcionar un archivo válido.");
  }

  const config = { ...DEFAULT_OPTIONS, ...options };

  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new TypeError(
      "Formato no admitido. Utiliza JPEG, PNG o WebP.",
    );
  }

  if (file.size === 0) {
    throw new Error("El archivo está vacío.");
  }

  if (file.size > config.maxFileSizeMB * 1024 * 1024) {
    throw new Error(
      `La imagen supera el límite de ${config.maxFileSizeMB} MB.`,
    );
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await decodeImage(objectUrl);

    if (
      image.naturalWidth < config.minWidth ||
      image.naturalHeight < config.minHeight
    ) {
      throw new Error(
        `La imagen debe medir al menos ${config.minWidth} × ${config.minHeight} píxeles.`,
      );
    }

    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      mimeType: file.type,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(
        new Error(
          "No se pudo decodificar la imagen. El archivo podría estar dañado.",
        ),
      );
    };

    image.src = src;
  });
}
