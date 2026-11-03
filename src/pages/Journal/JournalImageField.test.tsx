import React, { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import JournalImageField, { type PickedImage } from "./JournalImageField";
import { loadCropPicture, mockCanvas, mockFetchImage, mockObjectUrls } from "../../components/ImageCropDialog.testing";

let urls: ReturnType<typeof mockObjectUrls>;
beforeEach(() => {
  urls = mockObjectUrls();
  mockCanvas();
});

const SAVED = "https://api.test/api/v1/images/cover.jpg";

const renderField = (kind: "cover" | "author", initial: PickedImage | null = null) => {
  const onChange = vi.fn<(value: PickedImage | null) => void>();
  const Field = () => {
    const [value, setValue] = useState(initial);
    return (
      <JournalImageField
        kind={kind}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  };
  const view = render(<Field />);
  const pick = (file: File) =>
    fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [file] } });
  return { ...view, onChange, pick };
};

describe("Journal cover", () => {
  it("crops a picked picture at 16:9 by default, and crops it again from the whole file", async () => {
    const { onChange, pick } = renderField("cover");
    const original = new File(["raw"], "beach.jpg", { type: "image/jpeg" });
    pick(original);

    expect(await screen.findByText("Crop cover image")).toBeInTheDocument();
    expect(screen.getByText(/Journal listings show covers at 16:9/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "16:9" })).toBeChecked();
    for (const name of ["Free", "Custom"]) expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    await loadCropPicture(4000, 3000);
    fireEvent.click(screen.getByRole("button", { name: "Apply crop" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const first = onChange.mock.calls[0][0]!;
    expect(first.source).toBe(original);
    expect(first.file).not.toBe(original);
    expect(first.file).toMatchObject({ name: "beach.jpg", type: "image/jpeg" });
    expect(screen.getByAltText("Cover preview").getAttribute("src")).toMatch(/^blob:test\//);

    fireEvent.click(screen.getByRole("button", { name: "scissor Crop again" }));
    await loadCropPicture(4000, 3000);
    // The dialog shows the whole picked file, not the earlier crop.
    expect(urls.create).toHaveBeenLastCalledWith(original);
    fireEvent.click(screen.getByRole("radio", { name: "Free" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply crop" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(onChange.mock.calls[1][0]!.source).toBe(original);
  });

  it("crops the saved cover again from the stored picture", async () => {
    const fetch = mockFetchImage("image/jpeg");
    const { onChange } = renderField("cover", { source: SAVED });
    expect(screen.getByAltText("Cover preview")).toHaveAttribute("src", SAVED);

    fireEvent.click(screen.getByRole("button", { name: "scissor Crop again" }));
    await loadCropPicture(3000, 3000);
    expect(fetch).toHaveBeenCalledWith(SAVED, expect.objectContaining({ mode: "cors", cache: "reload" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply crop" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const value = onChange.mock.calls[0][0]!;
    expect(value.source).toBe(SAVED);
    expect(value.file).toMatchObject({ name: "cover.jpg", type: "image/jpeg" });
  });

  it("changes nothing when the crop is cancelled", async () => {
    const { onChange, pick } = renderField("cover", { source: SAVED });
    pick(new File(["raw"], "beach.jpg", { type: "image/jpeg" }));
    await loadCropPicture(4000, 3000);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText("Crop cover image")).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByAltText("Cover preview")).toHaveAttribute("src", SAVED);
  });
});

describe("Author photo", () => {
  it("crops square by default, shown round, with Free and Custom too", async () => {
    const { onChange, pick } = renderField("author");
    pick(new File(["raw"], "ann.png", { type: "image/png" }));

    expect(await screen.findByText("Crop author photo")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "1:1" })).toBeChecked();
    for (const name of ["Free", "Custom"]) expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    await loadCropPicture(1200, 900);
    expect(document.querySelector(".ReactCrop--circular-crop")).toBeInTheDocument();
    expect(screen.getByText("Result: 900 × 900 px")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply crop" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0]!.file).toMatchObject({ name: "ann.png", type: "image/png" });
    expect(screen.getByRole("button", { name: "scissor Crop again" })).toBeInTheDocument();
  });
});
