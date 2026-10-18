export interface LoadedImage {
    image: HTMLImageElement;
    width: number;
    height: number;
    mimeType: string;
}
export interface ImageLoaderOptions {
    minWidth?: number;
    minHeight?: number;
    maxFileSizeMB?: number;
}
export declare function loadImage(file: File, options?: ImageLoaderOptions): Promise<LoadedImage>;
