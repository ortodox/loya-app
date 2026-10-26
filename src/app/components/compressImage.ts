import { fitWithin, maxPhotoBytes } from "@/logic/rules/visits";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Cannot read image"));
    img.src = url;
  });
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * LOT1: compresses a camera or library photo on the phone before upload – at most 1600 px on the
 * long side, JPEG, lowering the quality until it fits the size limit. EXIF orientation is applied
 * by the browser when the image is drawn.
 */
export async function compressImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    ctx.drawImage(img, 0, 0, width, height);
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      const blob = await toJpeg(canvas, quality);
      if (blob && blob.size <= maxPhotoBytes) return blob;
    }
    throw new Error("Photo too large");
  } finally {
    URL.revokeObjectURL(url);
  }
}
