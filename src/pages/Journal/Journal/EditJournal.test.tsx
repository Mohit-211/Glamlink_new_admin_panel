import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import EditJournal from "./EditJournal";
import { loadCropPicture, mockCanvas, mockFetchImage, mockObjectUrls } from "../../../components/ImageCropDialog.testing";

// No network in tests: the journal below, no mentions, and empty lists for everything else.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), post: vi.fn<Call>(), put: vi.fn<Call>() },
    // utils/apiError reads failures through this.
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});
// The body editor (Tiptap) has its own tests; a text box stands in for it here.
vi.mock("../../../components/RichTextEditor", () => ({
  default: ({ value, onChange }: { value?: string; onChange: (html: string) => void }) => (
    <textarea aria-label="Journal body" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const API = "https://api.test/api/v1/";
const COVER = `${API}images/cover.jpg`;
const JOURNAL = {
  id: 7,
  title: "Glow guide",
  short_description: "How to glow",
  author_id: 1,
  category_id: 2,
  status: "draft",
  slug: "glow-guide",
  content: "<p>Body</p>",
  cover_image: COVER,
  downloads: [],
};

beforeEach(() => {
  mockObjectUrls();
  mockCanvas();
  vi.mocked(axios.get).mockImplementation(async (url) => {
    if (String(url) === `${API}journal/findJournalById/7`) return { data: { data: JOURNAL } };
    if (String(url) === `${API}journal/7/mentions`) return { data: { data: { mentions: [], unmatched: [] } } };
    return { data: { data: [], rows: [] } };
  });
  vi.mocked(axios.put).mockResolvedValue({ data: { data: JOURNAL } });
  vi.mocked(axios.post).mockResolvedValue({ data: { data: {} } });
});

const openJournal = async () => {
  render(
    <MemoryRouter initialEntries={["/edit-journal/7"]}>
      <Routes>
        <Route path="/edit-journal/:id" element={<EditJournal />} />
        <Route path="/journals" element={<p>Journal list</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByDisplayValue("Glow guide");
};

const save = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Update journal" }));
  await screen.findByText("Journal list");
  return vi.mocked(axios.put).mock.calls[0][1] as FormData;
};

describe("Edit journal: cover", () => {
  it("crops the saved cover again from the stored picture, and saves the crop", async () => {
    const fetch = mockFetchImage("image/jpeg");
    await openJournal();
    expect(screen.getByAltText("Cover preview")).toHaveAttribute("src", COVER);

    fireEvent.click(screen.getByRole("button", { name: "scissor Crop again" }));
    await loadCropPicture(4000, 3000);
    expect(fetch).toHaveBeenCalledWith(COVER, expect.objectContaining({ mode: "cors", cache: "reload" }));
    expect(screen.getByRole("radio", { name: "16:9" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Apply crop" }));
    await waitFor(() => expect(screen.queryByText("Crop cover image")).toBeNull());

    expect((await save()).get("images")).toMatchObject({ name: "cover.jpg", type: "image/jpeg" });
  });

  it("sends no cover when it wasn't changed", async () => {
    await openJournal();
    expect((await save()).get("images")).toBeNull();
  });
});
