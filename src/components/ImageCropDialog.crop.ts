/** @format */

// The maths and drawing behind ImageCropDialog, apart from the UI so they can be tested.
// The admin draws the crop on the picture as shown, turned by `rotation` (clockwise), and it is
// kept in percent of that picture. The result is cut from the full-size source, so it keeps the
// source's resolution whatever size the picture had on screen.
import type { PercentCrop } from "react-image-crop";

export type Rotation = 0 | 90 | 180 | 270;
/** A fixed crop ratio, width:height, e.g. "16:9". */
export type Ratio = `${number}:${number}`;

export interface Size {
  width: number;
  height: number;
}
export interface Rect extends Size {
  x: number;
  y: number;
}

/** The longest side of a cropped picture, in px; a bigger crop is scaled down to it. */
export const MAX_EDGE = 4000;
/** Quality of a cropped JPEG or WebP. */
export const QUALITY = 0.92;
/** The whole picture, as a crop. */
export const WHOLE: PercentCrop = { unit: "%", x: 0, y: 0, width: 100, height: 100 };

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** "16:9" is 16 / 9; undefined unless both sides are positive numbers. */
export const parseRatio = (ratio: string): number | undefined => {
  const [w, h] = ratio.split(":").map(Number);
  return w > 0 && h > 0 ? w / h : undefined;
};

/** The picture's size once turned by `rotation`. */
export const turnedSize = ({ width, height }: Size, rotation: Rotation): Size =>
  rotation % 180 ? { width: height, height: width } : { width, height };

/** The largest crop of `aspect` (width / height) centred on a picture of `size`, or the whole picture without an aspect. */
export const largestCrop = (aspect: number | undefined, { width, height }: Size): PercentCrop => {
  if (!aspect) return { ...WHOLE };
  const w = (Math.min(width, height * aspect) / width) * 100;
  const h = (Math.min(height, width / aspect) / height) * 100;
  return { unit: "%", x: (100 - w) / 2, y: (100 - h) / 2, width: w, height: h };
};

/** A crop in percent of the turned picture, in whole pixels of it at full size, kept inside it and at least 1 x 1. */
export const cropPixels = (crop: PercentCrop, turned: Size): Rect => {
  const x = clamp(Math.round((crop.x / 100) * turned.width), 0, turned.width - 1);
  const y = clamp(Math.round((crop.y / 100) * turned.height), 0, turned.height - 1);
  return {
    x,
    y,
    width: clamp(Math.round((crop.width / 100) * turned.width), 1, turned.width - x),
    height: clamp(Math.round((crop.height / 100) * turned.height), 1, turned.height - y),
  };
};

/** The same area in the source's own pixels, before it was turned. `source` is the unturned size. */
export const sourceRect = ({ x, y, width, height }: Rect, source: Size, rotation: Rotation): Rect => {
  switch (rotation) {
    case 90: // the source's left edge is now the top
      return { x: y, y: source.height - x - width, width: height, height: width };
    case 180:
      return { x: source.width - x - width, y: source.height - y - height, width, height };
    case 270: // the source's top edge is now the left
      return { x: source.width - y - height, y: x, width: height, height: width };
    default:
      return { x, y, width, height };
  }
};

/** The saved picture's size: the crop's, with the longest side at most `maxEdge`. */
export const outputSize = ({ width, height }: Size, maxEdge = MAX_EDGE): Size => {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

/** PNG and WebP stay as they are (either may be transparent); anything else is saved as JPEG. */
export const outputType = (type: string) => (type === "image/png" || type === "image/webp" ? type : "image/jpeg");

const EXTENSION: Record<string, string> = { "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg" };

/** `name` with an extension that fits `type`: "photo.gif" saved as JPEG is "photo.jpg". */
export const fileName = (name: string, type: string) => {
  const ext = EXTENSION[type] ?? "jpg";
  const fits = ext === "jpg" ? /\.jpe?g$/i : new RegExp(`\\.${ext}$`, "i");
  return fits.test(name) ? name : `${name.replace(/\.[^.]*$/, "") || "image"}.${ext}`;
};

/**
 * Cuts `crop` (percent of the picture turned by `rotation`) out of the full-size `image`, whose
 * own size is `source`, and encodes it as `type`, scaled down to `maxEdge` if it is bigger.
 */
export const cropToBlob = async (
  image: CanvasImageSource,
  source: Size,
  crop: PercentCrop,
  rotation: Rotation,
  { type, maxEdge = MAX_EDGE }: { type: string; maxEdge?: number },
): Promise<{ blob: Blob; size: Size }> => {
  const rect = cropPixels(crop, turnedSize(source, rotation));
  const from = sourceRect(rect, source, rotation);
  const size = outputSize(rect, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the picture");
  if (type === "image/jpeg") {
    // JPEG has no transparency; transparent parts would otherwise turn black.
    ctx.fillStyle = "#ffffff"; // color-literal-ok: background of the saved picture
    ctx.fillRect(0, 0, size.width, size.height);
  }
  ctx.imageSmoothingQuality = "high";
  // Turn about the canvas centre, then draw the source area so that, once turned, it fills the canvas.
  const [w, h] = rotation % 180 ? [size.height, size.width] : [size.width, size.height];
  ctx.translate(size.width / 2, size.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(image, from.x, from.y, from.width, from.height, -w / 2, -h / 2, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
  if (!blob) throw new Error("This browser couldn't save the cropped picture");
  return { blob, size };
};

/**
 * Downloads a picture that is already uploaded, as a File to crop. The request asks for CORS and
 * skips the cache: a copy the browser cached for a plain <img> may lack the CORS headers, and
 * drawing it would taint the canvas.
 */
export const fetchImage = async (url: string, signal?: AbortSignal): Promise<File> => {
  const res = await fetch(url, { mode: "cors", cache: "reload", signal });
  if (!res.ok) throw new Error(`The picture answered ${res.status}`);
  const blob = await res.blob();
  const name = url.startsWith("data:") ? "image" : new URL(url, window.location.href).pathname.split("/").pop() || "image";
  const type = blob.type.startsWith("image/") ? blob.type : (/\.png$/i.test(name) ? "image/png" : /\.webp$/i.test(name) ? "image/webp" : "image/jpeg");
  return new File([blob], name, { type });
};
