import type { CardValidatorParams, CardValidatorResponse } from "./public-types";
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
export declare class CardValidatorOCR {
    private file;
    private params;
    private reader;
    private readerLanguage;
    private queue;
    setFile(file: File): this;
    /** Reemplaza los parámetros; los no indicados vuelven a su valor por defecto. */
    setParams(params: CardValidatorParams): this;
    /** Procesa el archivo configurado. Nunca lanza: los fallos llegan en `error`. */
    send(): Promise<CardValidatorResponse>;
    /** Libera el motor OCR. Se puede seguir usando el validador: se recreará en el siguiente `send()`. */
    dispose(): Promise<void>;
    private execute;
    private getReader;
}
/** Atajo de una sola llamada: crea el validador, lee el archivo y libera los recursos. */
export declare function validateCard(file: File, params?: CardValidatorParams): Promise<CardValidatorResponse>;
