import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Authors from "./Authors";
import { AddAuthors, GetAllAuthors, UpdateAuthors } from "../../../services/Api/JournalApi";
import { loadCropPicture, mockCanvas, mockFetchImage, mockObjectUrls } from "../../../components/ImageCropDialog.testing";

vi.mock("../../../services/Api/JournalApi", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return { GetAllAuthors: vi.fn<Call>(), AddAuthors: vi.fn<Call>(), UpdateAuthors: vi.fn<Call>(), DeleteAuthors: vi.fn<Call>() };
});

const PHOTO = "https://api.test/api/v1/images/ann.jpg";

beforeEach(() => {
  mockObjectUrls();
  mockCanvas();
  vi.mocked(GetAllAuthors).mockResolvedValue({
    data: { rows: [{ id: 1, name: "Ann Lee", designation: "Editor", bio: "Writes about skin.", profile_image: PHOTO }] },
  } as Awaited<ReturnType<typeof GetAllAuthors>>);
});

const openAuthors = async () => {
  render(<Authors />);
  await screen.findByText("Ann Lee");
};

const applyCrop = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Apply crop" }));
  await waitFor(() => expect(screen.queryByText("Crop author photo")).toBeNull());
};

describe("Authors: photos", () => {
  it("uploads the cropped photo with a new author", async () => {
    await openAuthors();
    fireEvent.click(screen.getByRole("button", { name: "plus Add Author" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bo Chen" } });
    fireEvent.change(screen.getByLabelText("Designation"), { target: { value: "Writer" } });
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "Writes about hair." } });
    const original = new File(["raw"], "bo.jpg", { type: "image/jpeg" });
    fireEvent.change(document.querySelector('.ant-modal input[type="file"]')!, { target: { files: [original] } });
    await loadCropPicture(1200, 900);
    await applyCrop();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(AddAuthors).toHaveBeenCalled());
    const sent = vi.mocked(AddAuthors).mock.calls[0][0].get("images");
    expect(sent).not.toBe(original);
    expect(sent).toMatchObject({ name: "bo.jpg", type: "image/jpeg" });
  });

  it("crops the saved photo again from the stored picture, and leaves an untouched one alone", async () => {
    const fetch = mockFetchImage("image/jpeg");
    await openAuthors();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByAltText("Author photo")).toHaveAttribute("src", PHOTO);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(UpdateAuthors).toHaveBeenCalledTimes(1));
    expect(vi.mocked(UpdateAuthors).mock.calls[0][1].get("images")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "scissor Crop again" }));
    await loadCropPicture(1600, 1200);
    expect(fetch).toHaveBeenCalledWith(PHOTO, expect.objectContaining({ mode: "cors", cache: "reload" }));
    await applyCrop();
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => expect(UpdateAuthors).toHaveBeenCalledTimes(2));
    const [id, form] = vi.mocked(UpdateAuthors).mock.calls[1];
    expect(id).toBe(1);
    expect(form.get("images")).toMatchObject({ name: "ann.jpg", type: "image/jpeg" });
  });
});
