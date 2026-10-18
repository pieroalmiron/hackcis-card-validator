import type { FieldSpec } from "../ocr/regions";

// ───────────── Normalización ─────────────

export function normalizeWhitespace(text: string): string {
  // NFC conserva (y compone) las tildes.
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function stripLabel(text: string, pattern?: RegExp): string {
  return pattern ? normalizeWhitespace(text.replace(pattern, "")) : text;
}

/** Solo para campos numéricos: corrige confusiones típicas letra→dígito y elimina el resto. */
const DIGIT_CONFUSIONS: Record<string, string> = {
  O: "0", o: "0", Q: "0", D: "0",
  I: "1", l: "1", "|": "1", i: "1",
  Z: "2", S: "5", s: "5", B: "8",
};

export function normalizeNumeric(text: string): string {
  let out = "";
  for (const ch of text) {
    if (/\d/.test(ch)) out += ch;
    else if (ch in DIGIT_CONFUSIONS) out += DIGIT_CONFUSIONS[ch];
  }
  return out;
}

/** El código único se conserva como string; solo mayúsculas y sin separadores. */
export function normalizeCode(text: string): string {
  return text.normalize("NFC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizePeriod(text: string): string {
  const cleaned = text
    .replace(/[–—_.:\s]/g, (c) => (c === " " ? "" : "-"))
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1");
  const m = cleaned.match(/(\d{4})-?(\d)/);
  return m ? `${m[1]}-${m[2]}` : normalizeWhitespace(cleaned);
}

export function normalizeField(spec: FieldSpec, rawText: string): string {
  const base = stripLabel(normalizeWhitespace(rawText), spec.labelPattern);
  switch (spec.kind) {
    case "numeric":
      return normalizeNumeric(base);
    case "code":
      return normalizeCode(base);
    case "period":
      return normalizePeriod(base);
    case "alpha":
    case "text": {
      // Conserva letras, tildes y números; los puntos y guiones solo si el campo los admite.
      const noise = spec.stripPunctuation
        ? /[^\p{L}\p{N} ]/gu
        : /[^\p{L}\p{N}.,'\- ]/gu;
      return normalizeWhitespace(base.replace(noise, " "));
    }
  }
}

// ───────────── Validación ─────────────

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const ALPHA_RE = /^[\p{L}][\p{L}'\- ]*$/u;
const LETTER_COUNT = (s: string): number => (s.match(/\p{L}/gu) ?? []).length;

export function validateField(spec: FieldSpec, value: string): ValidationResult {
  switch (spec.kind) {
    case "numeric": {
      if (!/^\d+$/.test(value)) return { valid: false, reason: "No es numérico." };
      if (spec.expectedLength && value.length !== spec.expectedLength) {
        return { valid: false, reason: `Longitud ${value.length}, se esperaban ${spec.expectedLength}.` };
      }
      if (spec.range) {
        const n = Number(value);
        if (n < spec.range[0] || n > spec.range[1]) {
          return { valid: false, reason: `Fuera de rango ${spec.range[0]}–${spec.range[1]}.` };
        }
      }
      return { valid: true };
    }
    case "alpha":
      if (value.length < 2 || !ALPHA_RE.test(value)) {
        return { valid: false, reason: "Contiene caracteres no alfabéticos o es demasiado corto." };
      }
      return { valid: true };
    case "text":
      return LETTER_COUNT(value) >= 3
        ? { valid: true }
        : { valid: false, reason: "Texto demasiado corto o sin letras suficientes." };
    case "code":
      // Formato del código único NO confirmado: solo se exige alfanumérico razonable.
      return /^[A-Z0-9]{4,16}$/.test(value)
        ? { valid: true }
        : { valid: false, reason: "No tiene forma de código alfanumérico (4–16)." };
    case "period":
      return /^\d{4}-\d$/.test(value)
        ? { valid: true }
        : { valid: false, reason: "No cumple el formato AAAA-N." };
  }
}