import { describe, expect, it } from "vitest";
import {
  cropPixels,
  cropToBlob,
  fetchImage,
  fileName,
  largestCrop,
  outputSize,
  outputType,
  parseRatio,
  sourceRect,
  turnedSize,
  type Rotation,
  type Size,
} from "./ImageCropDialog.crop";
import { mockCanvas, mockFetchImage, type DrawCall } from "./ImageCropDialog.testing";

// Where a clockwise turn by `rotation` puts the source's pixel (x, y).
const turn = (x: number, y: number, { width, height }: Size, rotation: Rotation) =>
  ({ 0: [x, y], 90: [height - y, x], 180: [width - x, height - y], 270: [y, width - x] })[rotation];

// Where the recorded drawing puts the source's pixel (x, y) on the canvas: drawImage maps the
// source area onto its destination, then the rotation and the translation apply.
const onCanvas = (calls: DrawCall[], x: number, y: number) => {
  const arg = (name: string) => calls.find((c) => c.name === name)!.args as number[];
  const [tx, ty] = arg("translate");
  const [angle] = arg("rotate");
  const [, sx, sy, sw, sh, dx, dy, dw, dh] = arg("drawImage");
  const lx = dx + ((x - sx) * dw) / sw;
  const ly = dy + ((y - sy) * dh) / sh;
  return [tx + lx * Math.cos(angle) - ly * Math.sin(angle), ty + lx * Math.sin(angle) + ly * Math.cos(angle)];
};

const picture = {} as CanvasImageSource;

describe("crop shapes", () => {
  it("reads W:H ratios", () => {
    expect(parseRatio("16:9")).toBeCloseTo(16 / 9);
    expect(parseRatio("4:5")).toBe(0.8);
    expect(parseRatio("0:1")).toBeUndefined();
    expect(parseRatio("a:b")).toBeUndefined();
    expect(parseRatio("16")).toBeUndefined();
  });

  it("swaps width and height for a quarter turn", () => {
    expect(turnedSize({ width: 400, height: 300 }, 90)).toEqual({ width: 300, height: 400 });
    expect(turnedSize({ width: 400, height: 300 }, 180)).toEqual({ width: 400, height: 300 });
    expect(turnedSize({ width: 400, height: 300 }, 270)).toEqual({ width: 300, height: 400 });
  });

  it("starts from the largest centred crop of the shape, or the whole picture", () => {
    expect(largestCrop(16 / 9, { width: 4000, height: 3000 })).toEqual({ unit: "%", x: 0, y: 12.5, width: 100, height: 75 });
    expect(largestCrop(1, { width: 4000, height: 3000 })).toEqual({ unit: "%", x: 12.5, y: 0, width: 75, height: 100 });
    expect(largestCrop(0.8, { width: 1000, height: 1000 })).toEqual({ unit: "%", x: 10, y: 0, width: 80, height: 100 });
    expect(largestCrop(undefined, { width: 1000, height: 1000 })).toEqual({ unit: "%", x: 0, y: 0, width: 100, height: 100 });
  });
});

describe("from the crop on screen to source pixels", () => {
  it("turns a percent crop into whole pixels of the full-size picture, inside it", () => {
    expect(cropPixels({ unit: "%", x: 12.5, y: 0, width: 75, height: 100 }, { width: 4000, height: 3000 })).toEqual({
      x: 500,
      y: 0,
      width: 3000,
      height: 3000,
    });
    // Past the edge: kept inside, and never empty.
    expect(cropPixels({ unit: "%", x: 99.99, y: 0, width: 50, height: 100 }, { width: 100, height: 100 })).toEqual({
      x: 99,
      y: 0,
      width: 1,
      height: 100,
    });
  });

  it("finds the source area under a crop of the turned picture", () => {
    const source = { width: 400, height: 300 };
    // Turned right, the picture's top-left quarter is the source's bottom-left.
    expect(sourceRect({ x: 0, y: 0, width: 150, height: 200 }, source, 90)).toEqual({ x: 0, y: 150, width: 200, height: 150 });
    expect(sourceRect({ x: 0, y: 0, width: 200, height: 150 }, source, 180)).toEqual({ x: 200, y: 150, width: 200, height: 150 });
    // Turned left, it is the source's top-right.
    expect(sourceRect({ x: 0, y: 0, width: 150, height: 200 }, source, 270)).toEqual({ x: 200, y: 0, width: 200, height: 150 });
    expect(sourceRect({ x: 5, y: 6, width: 7, height: 8 }, source, 0)).toEqual({ x: 5, y: 6, width: 7, height: 8 });
  });

  it.each([0, 90, 180, 270] as Rotation[])("draws exactly the crop, turned %i°, at full resolution", async (rotation) => {
    const { calls, canvases } = mockCanvas();
    const source = { width: 400, height: 300 };
    const crop = { unit: "%" as const, x: 10, y: 20, width: 50, height: 40 };
    const turned = turnedSize(source, rotation);
    const rect = cropPixels(crop, turned);

    const { size } = await cropToBlob(picture, source, crop, rotation, { type: "image/png" });

    expect(size).toEqual({ width: rect.width, height: rect.height });
    expect([canvases[0].width, canvases[0].height]).toEqual([rect.width, rect.height]);
    const from = sourceRect(rect, source, rotation);
    expect(from.x).toBeGreaterThanOrEqual(0);
    expect(from.y).toBeGreaterThanOrEqual(0);
    expect(from.x + from.width).toBeLessThanOrEqual(source.width);
    expect(from.y + from.height).toBeLessThanOrEqual(source.height);
    // Every source pixel of the area lands where the turned picture shows it, less the crop's offset.
    const points = [
      [from.x, from.y],
      [from.x + from.width, from.y],
      [from.x, from.y + from.height],
      [from.x + from.width, from.y + from.height],
      [from.x + from.width / 2, from.y + from.height / 3],
    ];
    for (const [x, y] of points) {
      const [u, v] = turn(x, y, source, rotation);
      const [cx, cy] = onCanvas(calls, x, y);
      expect(cx).toBeCloseTo(u - rect.x, 6);
      expect(cy).toBeCloseTo(v - rect.y, 6);
    }
  });

  it("scales a crop longer than 4000 px down to 4000", async () => {
    const { calls, canvases } = mockCanvas();
    const whole = { unit: "%" as const, x: 0, y: 0, width: 100, height: 100 };
    const { size } = await cropToBlob(picture, { width: 8000, height: 6000 }, whole, 0, { type: "image/jpeg" });
    expect(size).toEqual({ width: 4000, height: 3000 });
    expect([canvases[0].width, canvases[0].height]).toEqual([4000, 3000]);
    expect(onCanvas(calls, 8000, 6000)).toEqual([4000, 3000]);
    expect(outputSize({ width: 6000, height: 3375 })).toEqual({ width: 4000, height: 2250 });
    expect(outputSize({ width: 3000, height: 9000 })).toEqual({ width: 1333, height: 4000 });
    expect(outputSize({ width: 1200, height: 800 })).toEqual({ width: 1200, height: 800 });
  });
});

describe("the saved file", () => {
  it("keeps PNG and WebP, and saves anything else as JPEG at 0.92 on white", async () => {
    expect(outputType("image/png")).toBe("image/png");
    expect(outputType("image/webp")).toBe("image/webp");
    expect(outputType("image/gif")).toBe("image/jpeg");
    expect(outputType("image/jpeg")).toBe("image/jpeg");

    const crop = { unit: "%" as const, x: 0, y: 0, width: 100, height: 100 };
    const jpeg = mockCanvas();
    const { blob } = await cropToBlob(picture, { width: 10, height: 10 }, crop, 0, { type: "image/jpeg" });
    expect(blob.type).toBe("image/jpeg");
    expect(jpeg.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.92);
    expect(jpeg.calls.find((c) => c.name === "fillRect")?.args).toEqual([0, 0, 10, 10]);

    const png = mockCanvas();
    await cropToBlob(picture, { width: 10, height: 10 }, crop, 0, { type: "image/png" });
    expect(png.calls.filter((c) => c.name === "fillRect")).toHaveLength(0);
  });

  it("names the file after the type it was saved as", () => {
    expect(fileName("photo.png", "image/png")).toBe("photo.png");
    expect(fileName("IMG_1.JPEG", "image/jpeg")).toBe("IMG_1.JPEG");
    expect(fileName("anim.gif", "image/jpeg")).toBe("anim.jpg");
    expect(fileName("pic.png", "image/jpeg")).toBe("pic.jpg");
    expect(fileName("scan", "image/webp")).toBe("scan.webp");
  });
});

describe("an uploaded picture", () => {
  it("is downloaded with a fresh CORS request, as a file named after its link", async () => {
    const fetch = mockFetchImage("image/png");
    const file = await fetchImage("https://api.test/api/v1/images/cover.png");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.test/api/v1/images/cover.png",
      expect.objectContaining({ mode: "cors", cache: "reload" }),
    );
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("cover.png");
    expect(file.type).toBe("image/png");
  });

  it("takes the type from the name when the server doesn't say, and fails on an error answer", async () => {
    mockFetchImage("application/octet-stream");
    expect((await fetchImage("https://api.test/images/a.webp")).type).toBe("image/webp");
    mockFetchImage("image/jpeg", { ok: false });
    await expect(fetchImage("https://api.test/images/gone.jpg")).rejects.toThrow(/404/);
  });
});
