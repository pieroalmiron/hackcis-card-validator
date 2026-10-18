import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import type { ProcessedImage } from "../image/image-preprocessor";
import { getCanvas } from "../image/processed-image-adapter";
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

const PSM_MAP: Record<PageSegMode, PSM> = {
  single_line: PSM.SINGLE_LINE,
  single_block: PSM.SINGLE_BLOCK,
  single_word: PSM.SINGLE_WORD,
};

type Profile = "default" | "raw";

export class TesseractOcrEngine implements OcrEngine {
  private readonly workers = new Map<Profile, Promise<Worker>>();

  constructor(private readonly lang: string = "spa") {}

  private getWorker(profile: Profile): Promise<Worker> {
    let p = this.workers.get(profile);
    if (!p) {
      // Los parámetros de diccionario solo se pueden fijar al inicializar el worker.
      p =
        profile === "raw"
          ? createWorker(this.lang, OEM.LSTM_ONLY, {}, { load_system_dawg: "0", load_freq_dawg: "0" })
          : createWorker(this.lang);
      this.workers.set(profile, p);
    }
    return p;
  }

  /** Llamar de forma secuencial: un worker procesa un trabajo a la vez. */
  async recognize(image: ProcessedImage, options: OcrRecognizeOptions = {}): Promise<OcrResult> {
    const worker = await this.getWorker(options.noDictionary ? "raw" : "default");
    await worker.setParameters({
      tessedit_pageseg_mode: PSM_MAP[options.pageSegMode ?? "single_line"],
      // Cadena vacía = restablece la whitelist para los campos que no la usan.
      tessedit_char_whitelist: options.whitelist ?? "",
      preserve_interword_spaces: "1",
    });
    const { data } = await worker.recognize(getCanvas(image));
    return { text: data.text, confidence: data.confidence };
  }

  async dispose(): Promise<void> {
    const pending = [...this.workers.values()];
    this.workers.clear();
    for (const p of pending) {
      try {
        await (await p).terminate();
      } catch {
        /* el worker ya había fallado al iniciar */
      }
    }
  }
}