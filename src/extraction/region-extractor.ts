import type { FieldReading, FieldState } from "../core/types";
import type { ProcessedImage } from "../image/image-preprocessor";
import type { OcrEngine } from "../ocr/ocr-engine";
import {
  FIELD_SPECS,
  type AttemptOverride,
  type FieldKind,
  type FieldSpec,
  type Region,
} from "../ocr/regions";
import { cropRegion } from "../image/region-cropper";
import { canvasToProcessedImage, getCanvas } from "../image/processed-image-adapter";
import { normalizeField, validateField } from "./field-rules";

/** Intentos extra por tipo de campo, usados si el spec no define `fallbacks`. */
const DEFAULT_FALLBACKS: Record<FieldKind, readonly AttemptOverride[]> = {
  numeric: [
    { psm: "single_word" },
    { inset: 0.08, targetHeightPx: 96 },
    { stretch: true, targetHeightPx: 96 },
    { stretch: true, psm: "single_word", marginX: 0.01, marginY: 0.008 },
  ],
  period: [{ psm: "single_word" }, { stretch: true, targetHeightPx: 96 }],
  alpha: [{ targetHeightPx: 96 }],
  text: [{ targetHeightPx: 96 }],
  code: [{ psm: "single_word" }, { stretch: true, targetHeightPx: 96 }],
};

const STATE_RANK: Record<FieldState, number> = {
  ok: 3,
  low_confidence: 2,
  invalid: 1,
  not_detected: 0,
};

function shrinkRegion(r: Region, inset: number): Region {
  const k = Math.min(Math.max(inset, 0), 0.4);
  const dx = r.width * k;
  const dy = r.height * k;
  return { x: r.x + dx, y: r.y + dy, width: r.width - 2 * dx, height: r.height - 2 * dy };
}

function isBetter(a: FieldReading, b: FieldReading): boolean {
  const ra = STATE_RANK[a.state];
  const rb = STATE_RANK[b.state];
  if (ra !== rb) return ra > rb;
  return (a.confidence ?? -1) > (b.confidence ?? -1);
}

/** Convierte el resultado crudo del OCR en una lectura normalizada y validada. */
function interpret(spec: FieldSpec, rawText: string, confidence: number): FieldReading {
  const value = normalizeField(spec, rawText);
  if (value === "") {
    return { key: spec.key, rawText, value: "", confidence, state: "not_detected" };
  }
  const validation = validateField(spec, value);
  if (!validation.valid) {
    return { key: spec.key, rawText, value: "", confidence, state: "invalid", reason: validation.reason };
  }
  if (confidence < spec.minConfidence) {
    return {
      key: spec.key, rawText, value, confidence, state: "low_confidence",
      reason: `Confianza ${confidence.toFixed(0)} < ${spec.minConfidence}.`,
    };
  }
  return { key: spec.key, rawText, value, confidence, state: "ok" };
}

/**
 * Votación posición a posición entre lecturas de la misma longitud.
 * La longitud ganadora es la más frecuente (desempata la suma de confianzas).
 * Cada voto pesa según la confianza de su lectura.
 */
function voteConsensus(spec: FieldSpec, readings: readonly FieldReading[]): FieldReading | null {
  const usable = readings.filter((r) => r.value !== "" && (r.state === "ok" || r.state === "low_confidence"));
  if (usable.length < 2) return null;

  const groups = new Map<number, FieldReading[]>();
  for (const r of usable) {
    const g = groups.get(r.value.length) ?? [];
    g.push(r);
    groups.set(r.value.length, g);
  }
  const sumConf = (g: FieldReading[]): number => g.reduce((s, r) => s + (r.confidence ?? 0), 0);
  let winners: FieldReading[] = [];
  for (const g of groups.values()) {
    if (
      g.length > winners.length ||
      (g.length === winners.length && sumConf(g) > sumConf(winners))
    ) {
      winners = g;
    }
  }
  if (winners.length < 2) return null;

  const len = winners[0].value.length;
  let value = "";
  let agreementSum = 0;
  for (let pos = 0; pos < len; pos++) {
    const weights = new Map<string, number>();
    let total = 0;
    for (const r of winners) {
      const w = Math.max(r.confidence ?? 0, 1);
      weights.set(r.value[pos], (weights.get(r.value[pos]) ?? 0) + w);
      total += w;
    }
    let bestCh = "";
    let bestW = -1;
    for (const [ch, w] of weights) {
      if (w > bestW) { bestW = w; bestCh = ch; }
    }
    value += bestCh;
    agreementSum += bestW / total;
  }

  const agreement = agreementSum / len; // 0–1
  const meanConf = winners.reduce((s, r) => s + (r.confidence ?? 0), 0) / winners.length;
  // La confianza combina lo que dice Tesseract con cuánto coinciden las lecturas.
  const confidence = meanConf * agreement;
  const detail = `Consenso de ${winners.length}/${readings.length} lecturas, acuerdo ${(agreement * 100).toFixed(0)} %.`;

  const validation = validateField(spec, value);
  if (!validation.valid) {
    return {
      key: spec.key, rawText: winners.map((r) => r.rawText.trim()).join(" | "),
      value: "", confidence, state: "invalid", reason: `${validation.reason} ${detail}`,
    };
  }
  const state: FieldState = confidence < spec.minConfidence ? "low_confidence" : "ok";
  return {
    key: spec.key,
    rawText: winners.map((r) => r.rawText.trim()).join(" | "),
    value, confidence, state, reason: detail,
  };
}

async function runAttempt(
  image: ProcessedImage,
  engine: OcrEngine,
  spec: FieldSpec,
  o: AttemptOverride,
): Promise<{ reading: FieldReading; crop: HTMLCanvasElement }> {
  const region = o.inset ? shrinkRegion(spec.region, o.inset) : spec.region;
  const crop = cropRegion(getCanvas(image), region, {
    marginX: o.marginX ?? spec.marginX,
    marginY: o.marginY ?? spec.marginY,
    invert: o.invert ?? spec.invert,
    stretch: o.stretch,
    binarize: o.binarize,
    thicken: o.thicken,
    targetHeightPx: o.targetHeightPx,
  });
  const ocr = await engine.recognize(canvasToProcessedImage(crop), {
    pageSegMode: o.psm ?? spec.psm,
    whitelist: spec.whitelist,
    noDictionary: spec.noDictionary,
  });
  return { reading: interpret(spec, ocr.text, ocr.confidence), crop };
}

export async function extractField(
  image: ProcessedImage,
  engine: OcrEngine,
  spec: FieldSpec,
): Promise<FieldReading> {
  const attempts: readonly AttemptOverride[] = [
    {},
    ...(spec.fallbacks ?? DEFAULT_FALLBACKS[spec.kind]),
  ];

  let best: FieldReading | null = null;
  let bestCrop: HTMLCanvasElement | null = null;
  const all: FieldReading[] = [];
  let lastError: string | undefined;
  let done = 0;

  for (const override of attempts) {
    done++;
    try {
      const { reading, crop } = await runAttempt(image, engine, spec, override);
      all.push(reading);
      if (!best || isBetter(reading, best)) {
        best = reading;
        bestCrop = crop;
      }
      // Con consenso se ejecutan todos los intentos; sin él, se corta al primer "ok".
      if (!spec.consensus && reading.state === "ok") break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Error desconocido al leer la región.";
    }
  }

  if (!best) {
    return {
      key: spec.key, rawText: "", value: "", confidence: null,
      state: "not_detected", reason: lastError, attempts: done,
    };
  }

  const voted = spec.consensus ? voteConsensus(spec, all) : null;
  const result: FieldReading = { ...(voted ?? best), attempts: done };

  // Campos poco fiables por naturaleza: nunca "ok", aunque la confianza sea alta.
  if (spec.alwaysReview && result.state === "ok") {
    result.state = "low_confidence";
    result.reason = `${spec.alwaysReview} ${result.reason ?? ""}`.trim();
  } else if (result.state !== "ok" && done > 1) {
    result.reason = `${result.reason ?? ""} (${done} intentos)`.trim();
  }

  if (bestCrop) result.cropDataUrl = bestCrop.toDataURL("image/png");
  return result;
}

/** Secuencial a propósito: un worker de Tesseract procesa un trabajo a la vez. */
export async function extractAllFields(
  image: ProcessedImage,
  engine: OcrEngine,
  specs: readonly FieldSpec[] = FIELD_SPECS,
): Promise<FieldReading[]> {
  const readings: FieldReading[] = [];
  for (const spec of specs) {
    readings.push(await extractField(image, engine, spec));
  }
  return readings;
}