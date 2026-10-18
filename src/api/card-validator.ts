import { CardReader } from "../core/reader";
import type { CardReadResult, FieldReading } from "../core/types";
import { TesseractOcrEngine } from "../ocr/ocr-engine";
import { FIELD_KEYS } from "../ocr/regions";
import type {
  CardData,
  CardValidatorError,
  CardValidatorParams,
  CardValidatorResponse,
  FieldDetail,
  ValidationStatus,
} from "./public-types";

type ResolvedParams = Required<CardValidatorParams>;

const DEFAULT_PARAMS: ResolvedParams = {
  language: "spa",
  includeFieldDetails: false,
  includeRawText: false,
  includeCropImages: false,
};

const LANGUAGE_RE = /^[a-z]{3}(\+[a-z]{3})*$/;

function emptyData(): CardData {
  return Object.fromEntries(FIELD_KEYS.map((k) => [k, ""])) as unknown as CardData;
}

function buildResponse(
  status: ValidationStatus,
  parts: Partial<Pick<CardValidatorResponse, "data" | "fieldsToReview" | "warnings" | "details">> & {
    error?: CardValidatorError | null;
  } = {},
): CardValidatorResponse {
  const response: CardValidatorResponse = {
    status,
    flags: {
      recognized: status === "recognized",
      needsReview: status === "needs_review",
      unrecognized: status === "unrecognized",
      hasError: status === "error",
      authenticityVerified: false,
    },
    data: parts.data ?? emptyData(),
    fieldsToReview: parts.fieldsToReview ?? [],
    warnings: parts.warnings ?? [],
    error: parts.error ?? null,
  };
  if (parts.details) response.details = parts.details;
  return response;
}

function errorResponse(code: CardValidatorError["code"], message: string): CardValidatorResponse {
  return buildResponse("error", { error: { code, message } });
}

function toDetail(f: FieldReading, p: ResolvedParams): FieldDetail {
  const d: FieldDetail = {
    key: f.key,
    value: f.value,
    state: f.state,
    confidence: f.confidence,
  };
  if (f.reason) d.reason = f.reason;
  if (p.includeRawText) d.rawText = f.rawText;
  if (p.includeCropImages && f.cropDataUrl) d.cropImage = f.cropDataUrl;
  return d;
}

function toResponse(result: CardReadResult, p: ResolvedParams): CardValidatorResponse {
  const data = emptyData();
  for (const k of FIELD_KEYS) data[k] = result.data[k] ?? "";

  const fields = result.fields ?? [];
  const wantDetails = p.includeFieldDetails || p.includeRawText || p.includeCropImages;

  return buildResponse(result.status, {
    data,
    fieldsToReview: fields.filter((f) => f.state !== "ok").map((f) => f.key),
    warnings: result.warnings,
    details: wantDetails ? fields.map((f) => toDetail(f, p)) : undefined,
  });
}

/**
 * Fachada pública del SDK. Uso:
 *
 *   const validator = new CardValidatorOCR();
 *   validator.setFile(file).setParams({ includeFieldDetails: true });
 *   const response = await validator.send();
 *   ...
 *   await validator.dispose(); // al terminar de usar el validador
 *
 * Crea una instancia y reutilízala: el primer `send()` carga el motor OCR (lento)
 * y los siguientes lo reaprovechan.
 */
export class CardValidatorOCR {
  private file: File | null = null;
  private params: ResolvedParams = { ...DEFAULT_PARAMS };
  private reader: CardReader | null = null;
  private readerLanguage = "";
  private queue: Promise<void> = Promise.resolve();

  setFile(file: File): this {
    this.file = file;
    return this;
  }

  /** Reemplaza los parámetros; los no indicados vuelven a su valor por defecto. */
  setParams(params: CardValidatorParams): this {
    this.params = { ...DEFAULT_PARAMS };
    for (const key of Object.keys(DEFAULT_PARAMS) as (keyof ResolvedParams)[]) {
      const value = params[key];
      if (value !== undefined) (this.params[key] as unknown) = value;
    }
    return this;
  }

  /** Procesa el archivo configurado. Nunca lanza: los fallos llegan en `error`. */
  send(): Promise<CardValidatorResponse> {
    // Se captura el estado ahora, para que cambios posteriores no afecten a esta llamada.
    const file = this.file;
    const params = { ...this.params };
    const run = this.queue.then(() => this.execute(file, params));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** Libera el motor OCR. Se puede seguir usando el validador: se recreará en el siguiente `send()`. */
  async dispose(): Promise<void> {
    await this.queue;
    const reader = this.reader;
    this.reader = null;
    this.readerLanguage = "";
    if (reader) await reader.dispose();
  }

  private async execute(file: File | null, params: ResolvedParams): Promise<CardValidatorResponse> {
    if (!(file instanceof Blob)) {
      return errorResponse("NO_FILE", "No se ha indicado ningún archivo. Llama a setFile() antes de send().");
    }
    if (!LANGUAGE_RE.test(params.language)) {
      return errorResponse(
        "INVALID_PARAMS",
        `Idioma inválido: "${params.language}". Usa códigos de 3 letras, p. ej. "spa" o "spa+eng".`,
      );
    }
    try {
      const reader = await this.getReader(params.language);
      const result = await reader.read(file as File);
      return toResponse(result, params);
    } catch (err) {
      return errorResponse(
        "PROCESSING_ERROR",
        err instanceof Error ? err.message : "Error desconocido al procesar la imagen.",
      );
    }
  }

  private async getReader(language: string): Promise<CardReader> {
    if (this.reader && this.readerLanguage === language) return this.reader;
    if (this.reader) await this.reader.dispose();
    this.reader = new CardReader(new TesseractOcrEngine(language));
    this.readerLanguage = language;
    return this.reader;
  }
}

/** Atajo de una sola llamada: crea el validador, lee el archivo y libera los recursos. */
export async function validateCard(
  file: File,
  params: CardValidatorParams = {},
): Promise<CardValidatorResponse> {
  const validator = new CardValidatorOCR();
  try {
    return await validator.setFile(file).setParams(params).send();
  } finally {
    await validator.dispose();
  }
}