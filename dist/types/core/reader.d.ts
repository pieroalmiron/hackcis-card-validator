import type { CardReadResult, CardReadStatus, FieldReading } from "./types";
import { type OcrEngine } from "../ocr/ocr-engine";
import { type FieldSpec } from "../ocr/regions";
/**
 * Criterios de estado (explícitos):
 *  - "unrecognized": menos del 50 % de los campos REQUERIDOS tienen un valor utilizable
 *                    (estado ok o low_confidence).
 *  - "recognized"  : todos los campos requeridos están en estado "ok".
 *  - "needs_review": cualquier otro caso (algún requerido ausente, inválido o con baja confianza).
 * Los campos NO requeridos (títulos, universidad, lastname2, cardUniqueCode, low_title)
 * solo generan advertencias; no impiden "recognized".
 */
export declare const MIN_USABLE_REQUIRED_RATIO = 0.5;
export declare function decideStatus(readings: readonly FieldReading[], specs: readonly FieldSpec[]): CardReadStatus;
export declare class CardReader {
    private readonly engine;
    private readonly specs;
    constructor(engine?: OcrEngine, specs?: readonly FieldSpec[]);
    read(file: File): Promise<CardReadResult>;
    /** 8. Libera el worker de Tesseract. */
    dispose(): Promise<void>;
    private emptyData;
}
export declare function createCardReader(): CardReader;
