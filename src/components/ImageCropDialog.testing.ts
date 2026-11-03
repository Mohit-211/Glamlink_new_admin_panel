// Test helpers for ImageCropDialog. jsdom has no canvas and no object URLs, and loads no images.
import { fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";

/** URL.createObjectURL / revokeObjectURL handing out "blob:test/1", "blob:test/2"... */
export const mockObjectUrls = () => {
  let n = 0;
  const create = vi.fn<(object: Blob | MediaSource) => string>(() => `blob:test/${++n}`);
  const revoke = vi.fn<(url: string) => void>();
  Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
  return { create, revoke };
};

export interface DrawCall {
  name: string;
  args: unknown[];
}

/** A 2D context that records what is drawn, and a toBlob that answers a Blob of the type asked for. */
export const mockCanvas = () => {
  const calls: DrawCall[] = [];
  const canvases: HTMLCanvasElement[] = [];
  const record = (name: string) => (...args: unknown[]) => void calls.push({ name, args });
  const context = {
    fillStyle: "",
    imageSmoothingQuality: "low",
    fillRect: record("fillRect"),
    translate: record("translate"),
    rotate: record("rotate"),
    drawImage: record("drawImage"),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    canvases.push(this);
    return context;
  } as unknown as HTMLCanvasElement["getContext"]);
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback: BlobCallback, type?: string) => callback(new Blob(["pixels"], { type: type || "image/png" })));
  return { calls, canvases, context, toBlob };
};

/** fetch answering a picture of `type`; `ok: false` answers a 404. */
export const mockFetchImage = (type = "image/jpeg", { ok = true } = {}) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    blob: async () => new Blob(["stored"], { type }),
  } as Response);

/** Loads the picture in the open crop dialog as if it were `width` x `height` px. */
export const loadCropPicture = async (width: number, height: number) => {
  const img = await screen.findByAltText(/^Cropping /);
  Object.defineProperties(img, {
    naturalWidth: { value: width, configurable: true },
    naturalHeight: { value: height, configurable: true },
  });
  fireEvent.load(img);
  return img;
};

/** Answers the next file picker opened with input.click() with `files`. */
export const answerFilePicker = (files: File[]) =>
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementationOnce(function (this: HTMLInputElement) {
    Object.defineProperty(this, "files", { value: files, configurable: true });
    this.dispatchEvent(new Event("change"));
  });
