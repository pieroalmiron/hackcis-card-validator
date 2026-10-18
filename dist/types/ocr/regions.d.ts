/** Coordenadas normalizadas (0..1) relativas a la imagen completa. */
export interface Region {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface PixelBox {
    left: number;
    top: number;
    right: number;
    bottom: number;
}
/** Convierte una caja en píxeles (medida sobre una imagen de referencia) a una Region normalizada. */
export declare function regionFromPixels(box: PixelBox, imageWidth: number, imageHeight: number): Region;
/** Si la lista cambia de nombres respecto a ExtractedCardData, TypeScript fallará aquí. */
export declare const FIELD_KEYS: readonly ["title1", "title2", "low_title", "university", "code", "dni", "lastname1", "lastname2", "name", "faculty", "degree", "admission_period", "day_expiration", "month_expiration", "year_expiration"];
export type FieldKey = (typeof FIELD_KEYS)[number];
export type FieldKind = "numeric" | "alpha" | "text" | "code" | "period";
export type PageSegMode = "single_line" | "single_block" | "single_word";
/** Variación de un intento de lectura respecto a la configuración base del campo. */
export interface AttemptOverride {
    psm?: PageSegMode;
    invert?: boolean;
    /** Estiramiento lineal de contraste del recorte (no umbraliza, no borra trazos). */
    stretch?: boolean;
    /** Binariza (Otsu) tras el estiramiento de contraste. */
    binarize?: boolean;
    /** Engrosa los trazos oscuros N píxeles (cierra contornos huecos). */
    thicken?: number;
    marginX?: number;
    marginY?: number;
    /** Encoge la región por cada lado (fracción de su tamaño, 0–0.4). */
    inset?: number;
    targetHeightPx?: number;
}
export interface FieldSpec {
    key: FieldKey;
    region: Region;
    kind: FieldKind;
    /** Los campos requeridos determinan si el resultado es "recognized". */
    required: boolean;
    psm: PageSegMode;
    /** Solo para campos numéricos/códigos; con tildes la whitelist de Tesseract es poco fiable. */
    whitelist?: string;
    /** Longitud exacta esperada (numéricos / códigos). */
    expectedLength?: number;
    /** Rango numérico permitido (día, mes). */
    range?: readonly [number, number];
    /** Confianza mínima del campo (0–100) para considerarlo "ok". */
    minConfidence: number;
    /** Margen extra relativo a la imagen, para no cortar trazos. */
    marginX?: number;
    marginY?: number;
    /** Texto claro sobre fondo oscuro: invierte el recorte antes del OCR. */
    invert?: boolean;
    /** Etiqueta impresa que puede colarse en el recorte y debe eliminarse. */
    labelPattern?: RegExp;
    /** Quita toda la puntuación (títulos, universidad). */
    stripPunctuation?: boolean;
    /** Si existe, el campo nunca pasa de "low_confidence". El texto explica por qué. */
    alwaysReview?: string;
    /** Intentos extra si el primero no da "ok". Si no se define, se usan los de region-extractor por tipo. */
    fallbacks?: readonly AttemptOverride[];
    /** Ejecuta todos los intentos y decide por votación posición a posición. */
    consensus?: boolean;
    /** Usa un worker sin diccionario (para códigos que no son palabras). */
    noDictionary?: boolean;
}
/** Tamaño de la imagen de referencia sobre la que se midieron las cajas. */
export declare const REFERENCE_SIZE: {
    readonly width: 986;
    readonly height: 621;
};
/** ⚠️ PROVISIONAL: medido sobre UN escaneo plano. Valida con más carnés. */
export declare const REGION_CONFIG_STATUS: "PROVISIONAL";
export declare const FIELD_SPECS: readonly FieldSpec[];
