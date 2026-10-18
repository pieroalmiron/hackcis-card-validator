import type { ExtractedCardData } from "../core/types";

/** Coordenadas normalizadas (0..1) relativas a la imagen completa. */
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Convierte una caja en píxeles (medida sobre una imagen de referencia) a una Region normalizada. */
export function regionFromPixels(box: PixelBox, imageWidth: number, imageHeight: number): Region {
  return {
    x: box.left / imageWidth,
    y: box.top / imageHeight,
    width: (box.right - box.left) / imageWidth,
    height: (box.bottom - box.top) / imageHeight,
  };
}

/** Si la lista cambia de nombres respecto a ExtractedCardData, TypeScript fallará aquí. */
export const FIELD_KEYS = [
  "title1",
  "title2",
  "low_title",
  "university",
  "code",
  "dni",
  "lastname1",
  "lastname2",
  "name",
  "faculty",
  "degree",
  "admission_period",
  "day_expiration",
  "month_expiration",
  "year_expiration",
] as const satisfies readonly (keyof ExtractedCardData)[];

export type FieldKey = (typeof FIELD_KEYS)[number];

export type FieldKind =
  | "numeric" // solo dígitos
  | "alpha" // nombres y apellidos
  | "text" // varias palabras (facultad, carrera, títulos)
  | "code" // alfanumérico en mayúsculas, sin espacios
  | "period"; // AAAA-N

export type PageSegMode = "single_line" | "single_block" | "single_word";

/** Variación de un intento de lectura respecto a la configuración base del campo. */
export interface AttemptOverride {
    psm?: PageSegMode;
  invert?: boolean;
  /** Estiramiento lineal de contraste del recorte (no umbraliza, no borra trazos). */
  stretch?: boolean;
  /** Binariza (Otsu) tras el estiramiento de contraste. */
  binarize?: boolean;
  /** Engrosa los trazos oscuros N píxeles (cierra contornos huecos). */
  thicken?: number;
  marginX?: number;
  marginY?: number;
  /** Encoge la región por cada lado (fracción de su tamaño, 0–0.4). */
  inset?: number;
  targetHeightPx?: number;
}

export interface FieldSpec {
  key: FieldKey;
  region: Region;
  kind: FieldKind;
  /** Los campos requeridos determinan si el resultado es "recognized". */
  required: boolean;
  psm: PageSegMode;
  /** Solo para campos numéricos/códigos; con tildes la whitelist de Tesseract es poco fiable. */
  whitelist?: string;
  /** Longitud exacta esperada (numéricos / códigos). */
  expectedLength?: number;
  /** Rango numérico permitido (día, mes). */
  range?: readonly [number, number];
  /** Confianza mínima del campo (0–100) para considerarlo "ok". */
  minConfidence: number;
  /** Margen extra relativo a la imagen, para no cortar trazos. */
  marginX?: number;
  marginY?: number;
  /** Texto claro sobre fondo oscuro: invierte el recorte antes del OCR. */
  invert?: boolean;
  /** Etiqueta impresa que puede colarse en el recorte y debe eliminarse. */
  labelPattern?: RegExp;
  /** Quita toda la puntuación (títulos, universidad). */
  stripPunctuation?: boolean;
  /** Si existe, el campo nunca pasa de "low_confidence". El texto explica por qué. */
  alwaysReview?: string;
  /** Intentos extra si el primero no da "ok". Si no se define, se usan los de region-extractor por tipo. */
  fallbacks?: readonly AttemptOverride[];
    /** Ejecuta todos los intentos y decide por votación posición a posición. */
  consensus?: boolean;
  /** Usa un worker sin diccionario (para códigos que no son palabras). */
  noDictionary?: boolean;
}

/** Tamaño de la imagen de referencia sobre la que se midieron las cajas. */
export const REFERENCE_SIZE = { width: 986, height: 621 } as const;

/** ⚠️ PROVISIONAL: medido sobre UN escaneo plano. Valida con más carnés. */
export const REGION_CONFIG_STATUS = "PROVISIONAL" as const;

const DIGITS = "0123456789";

/** Etiquetas impresas que pueden colarse en el recorte. */
const LABELS = /^(c[oó]digo|dni|apellidos|nombres|facultad|carrera)\s*:?\s*/i;

function box(left: number, top: number, right: number, bottom: number): Region {
  return regionFromPixels(
    { left, top, right, bottom },
    REFERENCE_SIZE.width,
    REFERENCE_SIZE.height,
  );
}

export const FIELD_SPECS: readonly FieldSpec[] = [
  {
    key: "title1",
    region: box(148, 38, 345, 64),
    kind: "text", required: false, psm: "single_line", minConfidence: 50,
    stripPunctuation: true,
  },
  {
    key: "title2",
    region: box(148, 64, 800, 94),
    kind: "text", required: false, psm: "single_line", minConfidence: 50,
    stripPunctuation: true,
  },
  {
    key: "university",
    region: box(148, 103, 230, 134),
    kind: "text", required: false, psm: "single_line", minConfidence: 50,
    stripPunctuation: true,
  },
  {
    key: "code",
    region: box(448, 143, 572, 173),
    kind: "numeric", required: true, psm: "single_line", whitelist: DIGITS,
    expectedLength: 8, minConfidence: 70, labelPattern: LABELS,
  },
  {
    key: "dni",
    // Borde superior bajado para no rozar la línea "Código".
    region: box(430, 175, 552, 199),
    kind: "numeric", required: true, psm: "single_line", whitelist: DIGITS,
    expectedLength: 8, minConfidence: 70, labelPattern: LABELS, marginY: 0.001,
  },
  {
    key: "lastname1",
    region: box(354, 238, 478, 267),
    kind: "alpha", required: true, psm: "single_line", minConfidence: 60,
    marginY: 0.002, labelPattern: LABELS,
  },
  {
    key: "lastname2",
    region: box(354, 269, 462, 300),
    kind: "alpha", required: false, psm: "single_line", minConfidence: 60,
    marginY: 0.002,
  },
  {
    key: "name",
    region: box(354, 338, 654, 366),
    kind: "alpha", required: true, psm: "single_line", minConfidence: 60,
    marginY: 0.002, labelPattern: LABELS,
  },
  {
    key: "faculty",
    region: box(354, 408, 602, 436),
    kind: "text", required: true, psm: "single_line", minConfidence: 60,
    marginY: 0.002, labelPattern: LABELS,
  },
  {
    key: "degree",
    region: box(354, 461, 552, 488),
    kind: "text", required: true, psm: "single_line", minConfidence: 60,
    marginY: 0.002, labelPattern: LABELS,
  },
  {
    key: "admission_period",
    region: box(46, 500, 136, 530),
    kind: "period", required: true, psm: "single_line", whitelist: `${DIGITS}-`,
    minConfidence: 60,
  },
  {
    // Orden asumido de arriba a abajo: día / mes / año (por confirmar).
    key: "day_expiration",
    region: box(880, 195, 945, 234),
    kind: "numeric", required: true, psm: "single_line", whitelist: DIGITS,
    expectedLength: 2, range: [1, 31], minConfidence: 70,
  },
  {
    key: "month_expiration",
    region: box(880, 240, 945, 282),
    kind: "numeric", required: true, psm: "single_line", whitelist: DIGITS,
    expectedLength: 2, range: [1, 12], minConfidence: 70,
  },
  {
    key: "year_expiration",
    region: box(880, 286, 945, 328),
    kind: "numeric", required: true, psm: "single_line", whitelist: DIGITS,
    expectedLength: 2, range: [0, 99], minConfidence: 70,
  },
  {
    key: "low_title",
    region: box(38, 556, 450, 598),
    kind: "text", required: false, psm: "single_line", invert: true, minConfidence: 50,
    stripPunctuation: true,
    fallbacks: [
      { invert: false },
      { invert: false, targetHeightPx: 96 },
      { invert: false, stretch: true, targetHeightPx: 96 },
    ],
  },
];