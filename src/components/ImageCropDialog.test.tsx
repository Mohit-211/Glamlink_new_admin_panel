import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ImageCropDialog, { type ImageCropDialogProps, type ImageCropResult } from "./ImageCropDialog";
import { loadCropPicture, mockCanvas, mockFetchImage, mockObjectUrls } from "./ImageCropDialog.testing";

let urls: ReturnType<typeof mockObjectUrls>;
beforeEach(() => {
  urls = mockObjectUrls();
});

const photo = (name = "photo.jpg", type = "image/jpeg") => new File(["raw"], name, { type });

const open = (props: Partial<ImageCropDialogProps> = {}) => {
  const onDone = vi.fn<(result: ImageCropResult) => void>();
  const onCancel = vi.fn<() => void>();
  const view = render(<ImageCropDialog source={photo()} onDone={onDone} onCancel={onCancel} {...props} />);
  return { ...view, onDone, onCancel };
};

const radio = (name: string) => screen.getByRole("radio", { name });
const result = () => screen.getByText(/^Result:/).textContent;

describe("ImageCropDialog", () => {
  it("offers Original, the caller's ratios, Free and Custom, and shows the result's size", async () => {
    open({ ratios: ["16:9", "1:1"], initial: "16:9" });
    await loadCropPicture(4000, 3000);

    expect(screen.getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual([
      "Original",
      "16:9",
      "1:1",
      "Free",
      "Custom",
    ]);
    expect(radio("16:9")).toBeChecked();
    expect(result()).toBe("Result: 4000 × 2250 px");
    fireEvent.click(radio("1:1"));
    expect(result()).toBe("Result: 3000 × 3000 px");
    fireEvent.click(radio("Original"));
    expect(result()).toBe("Result: 4000 × 3000 px");
    fireEvent.click(radio("Free"));
    expect(result()).toBe("Result: 4000 × 3000 px");
    // Free and Original start from the whole picture; Free has no fixed shape.
    expect(document.querySelector(".ReactCrop--fixed-aspect")).toBeNull();
  });

  it("crops to a typed W:H ratio", async () => {
    open();
    await loadCropPicture(4000, 3000);
    fireEvent.click(radio("Custom"));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Width" }), { target: { value: "2" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Height" }), { target: { value: "1" } });
    expect(result()).toBe("Result: 4000 × 2000 px");
  });

  it("turns the picture by quarter turns, and the shape follows the turned picture", async () => {
    const canvas = mockCanvas();
    const { onDone } = open({ ratios: ["16:9"] });
    await loadCropPicture(4000, 3000);
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    expect(result()).toBe("Result: 3000 × 4000 px");
    // The turned copy on screen comes from the canvas.
    await waitFor(() => expect(screen.getByAltText(/^Cropping /)).toHaveAttribute("src", "blob:test/2"));
    fireEvent.click(radio("16:9"));
    expect(result()).toBe("Result: 3000 × 1688 px");
    fireEvent.click(screen.getByRole("button", { name: "Rotate left" }));
    fireEvent.click(screen.getByRole("button", { name: "Rotate left" }));
    expect(result()).toBe("Result: 3000 × 1688 px");

    fireEvent.click(screen.getByRole("button", { name: "Crop" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    // Saved turned left from the full-size picture: a quarter turn back.
    expect(canvas.calls.at(-2)).toEqual({ name: "rotate", args: [(270 * Math.PI) / 180] });
    expect(onDone.mock.calls[0][0].size).toEqual({ width: 3000, height: 1688 });
  });

  it("returns the cropped area at the source's full resolution, as the same kind of file", async () => {
    const canvas = mockCanvas();
    const { onDone } = open({ source: photo("logo.png", "image/png"), ratios: ["1:1"] });
    await loadCropPicture(4000, 3000);
    fireEvent.click(radio("1:1"));
    fireEvent.click(screen.getByRole("button", { name: "Crop" }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const { file, size } = onDone.mock.calls[0][0];
    expect(file).toMatchObject({ name: "logo.png", type: "image/png" });
    expect(size).toEqual({ width: 3000, height: 3000 });
    expect(canvas.calls.find((c) => c.name === "drawImage")?.args.slice(1)).toEqual([500, 0, 3000, 3000, -1500, -1500, 3000, 3000]);
  });

  it("scales a picture over 4000 px down, and returns one it didn't change as it is", async () => {
    const canvas = mockCanvas();
    const big = open();
    await loadCropPicture(6000, 4000);
    expect(result()).toBe("Result: 4000 × 2667 px (scaled down from 6000 × 4000)");
    fireEvent.click(screen.getByRole("button", { name: "Crop" }));
    await waitFor(() => expect(big.onDone).toHaveBeenCalled());
    expect(big.onDone.mock.calls[0][0].size).toEqual({ width: 4000, height: 2667 });
    big.unmount();

    const source = photo();
    const small = open({ source });
    await loadCropPicture(1200, 800);
    fireEvent.click(screen.getByRole("button", { name: "Crop" }));
    expect(small.onDone).toHaveBeenCalledWith({ file: source, size: { width: 1200, height: 800 } });
    expect(canvas.toBlob).toHaveBeenCalledTimes(1); // only the big one was drawn
  });

  it("offers Use as is, and Use as is for the rest of several pictures", async () => {
    const source = photo();
    const { onDone } = open({ source, allowSkip: true, progress: { index: 0, total: 3 } });
    expect(screen.getByText("Crop picture (1 of 3)")).toBeInTheDocument();
    await loadCropPicture(1200, 800);
    fireEvent.click(screen.getByRole("button", { name: "Use as is for the rest" }));
    expect(onDone).toHaveBeenCalledWith({ file: source, asIs: true, rest: true });
  });

  it("leaves out Use as is unless the caller allows it, and on the last picture leaves out the rest", async () => {
    const { unmount } = open();
    await loadCropPicture(1200, 800);
    expect(screen.queryByRole("button", { name: "Use as is" })).toBeNull();
    unmount();

    open({ allowSkip: true, progress: { index: 2, total: 3 } });
    await loadCropPicture(1200, 800);
    expect(screen.getByRole("button", { name: "Use as is" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use as is for the rest" })).toBeNull();
  });

  it("crops an uploaded picture from a fresh CORS download, and frees its object URL on close", async () => {
    mockCanvas();
    const fetch = mockFetchImage("image/webp");
    const { onDone, unmount } = open({ source: "https://api.test/api/v1/images/cover.webp", ratios: ["1:1"] });
    await loadCropPicture(2000, 1000);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.test/api/v1/images/cover.webp",
      expect.objectContaining({ mode: "cors", cache: "reload" }),
    );
    fireEvent.click(radio("1:1"));
    fireEvent.click(screen.getByRole("button", { name: "Crop" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0][0].file).toMatchObject({ name: "cover.webp", type: "image/webp" });

    unmount();
    expect(urls.revoke).toHaveBeenCalledWith("blob:test/1");
  });

  it("says so when an uploaded picture can't be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    open({ source: "https://elsewhere.example/a.jpg" });
    expect(await screen.findByText(/Couldn't load this picture for cropping/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crop" })).toBeDisabled();
  });

  it("cancels without a result", async () => {
    const { onDone, onCancel } = open();
    await loadCropPicture(1200, 800);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
