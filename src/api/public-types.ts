import type { ExtractedCardData, FieldState } from "../core/types";

export type { FieldState };

/** Todos los campos del carné; vacíos ("") si no se pudieron leer. */
export type CardData = Required<ExtractedCardData>;

export type ValidationStatus = "recognized" | "needs_review" | "unrecognized" | "error";

export type ValidatorErrorCode = "NO_FILE" | "INVALID_PARAMS" | "PROCESSING_ERROR";

/** Parámetros de entrada. Todos son opcionales. */
export interface CardValidatorParams {
  /** Idioma de OCR de Tesseract (códigos de 3 letras, p. ej. "spa" o "spa+eng"). Por defecto "spa". */
  language?: string;
  /** Incluye `details` con el estado y la confianza de cada campo. */
  includeFieldDetails?: boolean;
  /** Incluye el texto OCR sin procesar en cada detalle (implica `includeFieldDetails`). */
  includeRawText?: boolean;
  /** Incluye el recorte enviado al OCR como data URL PNG (pesado; implica `includeFieldDetails`). */
  includeCropImages?: boolean;
}

export interface FieldDetail {
  key: keyof CardData;
  value: string;
  state: FieldState;
  /** Confianza 0–100 de ese campo; null si no hubo lectura. */
  confidence: number | null;
  reason?: string;
  rawText?: string;
  cropImage?: string;
}

export interface CardValidatorFlags {
  /** Todos los campos requeridos se leyeron con confianza suficiente. */
  recognized: boolean;
  /** Hay datos, pero algún campo requerido es dudoso o falta. Requiere revisión humana. */
  needsReview: boolean;
  /** No se pudo leer lo suficiente para considerarlo un carné. */
  unrecognized: boolean;
  /** La ejecución falló; ver `error`. */
  hasError: boolean;
  /** Siempre false: el OCR lee texto, no verifica la autenticidad del carné. */
  readonly authenticityVerified: false;
}

export interface CardValidatorError {
  code: ValidatorErrorCode;
  message: string;
}

export interface CardValidatorResponse {
  status: ValidationStatus;
  flags: CardValidatorFlags;
  data: CardData;
  /** Claves de los campos que no están "ok" (dudosos, inválidos o no detectados). */
  fieldsToReview: string[];
  warnings: string[];
  error: CardValidatorError | null;
  /** Solo presente si se pidió con los parámetros. */
  details?: FieldDetail[];
}