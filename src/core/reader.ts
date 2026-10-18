import type {
  CardReadResult,
  CardReadStatus,
  ExtractedCardData,
  FieldReading,
} from "./types";
import { preprocessImage } from "../image/image-preprocessor";
import { loadImage } from "../image/image-loader";
import { getCanvas } from "../image/processed-image-adapter";
import { TesseractOcrEngine, type OcrEngine } from "../ocr/ocr-engine";
import { FIELD_KEYS, FIELD_SPECS, type FieldSpec } from "../ocr/regions";
import { extractAllFields } from "../extraction/region-extractor";

/**
 * Criterios de estado (explícitos):
 *  - "unrecognized": menos del 50 % de los campos REQUERIDOS tienen un valor utilizable
 *                    (estado ok o low_confidence).
 *  - "recognized"  : todos los campos requeridos están en estado "ok".
 *  - "needs_review": cualquier otro caso (algún requerido ausente, inválido o con baja confianza).
 * Los campos NO requeridos (títulos, universidad, lastname2, cardUniqueCode, low_title)
 * solo generan advertencias; no impiden "recognized".
 */
export const MIN_USABLE_REQUIRED_RATIO = 0.5;

const MIN_WIDTH = 600;
const MIN_HEIGHT = 350;
const EXPECTED_ASPECT = 1.58; // ~ ancho/alto del carné de referencia (1600×974 ≈ 1.64)
const ASPECT_TOLERANCE = 0.25;

export function decideStatus(
  readings: readonly FieldReading[],
  specs: readonly FieldSpec[],
): CardReadStatus {
  const required = specs.filter((s) => s.required);
  const byKey = new Map(readings.map((r) => [r.key, r]));
  let usable = 0;
  let allOk = true;
  for (const spec of required) {
    const state = byKey.get(spec.key)?.state ?? "not_detected";
    if (state === "ok" || state === "low_confidence") usable++;
    if (state !== "ok") allOk = false;
  }
  if (required.length === 0 || usable / required.length < MIN_USABLE_REQUIRED_RATIO) {
    return "unrecognized";
  }
  return allOk ? "recognized" : "needs_review";
}

export class CardReader {
  constructor(
    private readonly engine: OcrEngine = new TesseractOcrEngine(),
    private readonly specs: readonly FieldSpec[] = FIELD_SPECS,
  ) {}

  async read(file: File): Promise<CardReadResult> {
    const warnings: string[] = [
      "El OCR solo extrae texto; no verifica la autenticidad del carné.",
    ];

    // 1–2. Cargar y validar (el loader existente valida el formato).
    const loaded = await loadImage(file);
    // 3. Preparar.
    const processed = preprocessImage(loaded);
    const canvas = getCanvas(processed);

    if (canvas.width < MIN_WIDTH || canvas.height < MIN_HEIGHT) {
      return {
        status: "unrecognized",
        data: this.emptyData(),
        warnings: [...warnings, `Imagen demasiado pequeña (${canvas.width}×${canvas.height}).`],
        fields: [],
      };
    }
    const aspect = canvas.width / canvas.height;
    if (Math.abs(aspect - EXPECTED_ASPECT) > ASPECT_TOLERANCE) {
      warnings.push(
        "La proporción de la imagen no coincide con la de un carné encuadrado; " +
          "las regiones fijas pueden no alinear. Recorta la foto al borde del carné.",
      );
    }

    // 4. OCR por regiones.
    const fields = await extractAllFields(processed, this.engine, this.specs);

    // 5. Construir datos y advertencias.
    const data = this.emptyData() as unknown as Record<string, string>;
    for (const f of fields) data[f.key] = f.value;

    const specByKey = new Map(this.specs.map((s) => [s.key, s]));
    for (const f of fields) {
      const required = specByKey.get(f.key)?.required ?? false;
      const tag = required ? "" : " (opcional)";
      if (f.state === "not_detected") warnings.push(`${f.key}: no detectado${tag}.`);
      else if (f.state === "invalid") warnings.push(`${f.key}: formato inválido${tag}. ${f.reason ?? ""}`.trim());
      else if (f.state === "low_confidence") warnings.push(`${f.key}: baja confianza${tag}. ${f.reason ?? ""}`.trim());
    }

    // 6–7. Estado y resultado.
    return {
      status: decideStatus(fields, this.specs),
      data: data as unknown as ExtractedCardData,
      warnings,
      fields,
    };
  }

  /** 8. Libera el worker de Tesseract. */
  async dispose(): Promise<void> {
    await this.engine.dispose();
  }

  private emptyData(): ExtractedCardData {
    return Object.fromEntries(FIELD_KEYS.map((k) => [k, ""])) as unknown as ExtractedCardData;
  }
}

export function createCardReader(): CardReader {
  return new CardReader();
}