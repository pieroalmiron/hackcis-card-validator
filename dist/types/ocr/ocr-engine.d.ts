import type { ProcessedImage } from "../image/image-preprocessor";
import type { PageSegMode } from "./regions";
export interface OcrResult {
    text: string;
    /** 0–100, de la imagen que se le pasó al motor. */
    confidence: number;
}
export interface OcrRecognizeOptions {
    pageSegMode?: PageSegMode;
    /** Lista de caracteres permitidos. Vacío/undefined = sin restricción. */
    whitelist?: string;
    /** Usa un worker con los diccionarios desactivados (códigos, no palabras). */
    noDictionary?: boolean;
}
export interface OcrEngine {
    recognize(image: ProcessedImage, options?: OcrRecognizeOptions): Promise<OcrResult>;
    dispose(): Promise<void>;
}
export declare class TesseractOcrEngine implements OcrEngine {
    private readonly lang;
    private readonly workers;
    constructor(lang?: string);
    private getWorker;
    /** Llamar de forma secuencial: un worker procesa un trabajo a la vez. */
    recognize(image: ProcessedImage, options?: OcrRecognizeOptions): Promise<OcrResult>;
    dispose(): Promise<void>;
}
