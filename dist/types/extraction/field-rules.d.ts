import type { FieldSpec } from "../ocr/regions";
export declare function normalizeWhitespace(text: string): string;
export declare function stripLabel(text: string, pattern?: RegExp): string;
export declare function normalizeNumeric(text: string): string;
/** El código único se conserva como string; solo mayúsculas y sin separadores. */
export declare function normalizeCode(text: string): string;
export declare function normalizePeriod(text: string): string;
export declare function normalizeField(spec: FieldSpec, rawText: string): string;
export interface ValidationResult {
    valid: boolean;
    reason?: string;
}
export declare function validateField(spec: FieldSpec, value: string): ValidationResult;
