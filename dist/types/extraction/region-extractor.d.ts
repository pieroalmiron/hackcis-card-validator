import type { FieldReading } from "../core/types";
import type { ProcessedImage } from "../image/image-preprocessor";
import type { OcrEngine } from "../ocr/ocr-engine";
import { type FieldSpec } from "../ocr/regions";
export declare function extractField(image: ProcessedImage, engine: OcrEngine, spec: FieldSpec): Promise<FieldReading>;
/** Secuencial a propósito: un worker de Tesseract procesa un trabajo a la vez. */
export declare function extractAllFields(image: ProcessedImage, engine: OcrEngine, specs?: readonly FieldSpec[]): Promise<FieldReading[]>;
