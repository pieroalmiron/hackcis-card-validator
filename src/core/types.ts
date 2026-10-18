
export type CardReadStatus =
  | "recognized"
  | "unrecognized"
  | "needs_review";

export interface CardReaderOptions {
  language?: string;
  minImageWidth?: number;
}

export interface ExtractedCardData {
  title1?: string;
  title2?: string;
  low_title?: string;
  university?: string;
  code?: string;
  dni?: string;
  lastname1?: string;
  lastname2?: string;
  name?: string;
  faculty?: string;
  degree?: string;
  admission_period?: string;
  day_expiration?: string;
  month_expiration?: string;
  year_expiration?: string;
}

export interface CardReadResult {
  status: CardReadStatus;
  data: ExtractedCardData;
  warnings: string[];
  fields?: FieldReading[];
}

// ── Añadir al final de src/core/types.ts ──

export type ExtractedFieldKey = keyof ExtractedCardData;

/**
 * not_detected   : el OCR no devolvió texto útil en la región.
 * invalid        : hay texto, pero no cumple el formato esperado (el valor se descarta).
 * low_confidence : formato válido, pero la confianza del campo es baja.
 * ok             : formato válido y confianza suficiente.
 */
export type FieldState = "ok" | "low_confidence" | "invalid" | "not_detected";

export interface FieldReading {
  key: ExtractedFieldKey;
  /** Texto tal como lo devolvió el OCR (para depuración). */
  rawText: string;
  /** Valor normalizado. Vacío si el campo no se detectó o es inválido. */
  value: string;
  /** Confianza 0–100 de ESA región (no la global). null si no hubo OCR. */
  confidence: number | null;
  state: FieldState;
  reason?: string;
  /** Número de intentos de OCR realizados para este campo. */
  attempts?: number;
  /** Recorte enviado al OCR (PNG data URL generado localmente), para depurar. */
  cropDataUrl?: string;
}