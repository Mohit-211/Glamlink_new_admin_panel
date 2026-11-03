import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import MediaTab from "./MediaTab";
import type { PageMediaItem } from "../../types/profile";

// No network in tests: each test says what the API answers.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), post: vi.fn<Call>(), put: vi.fn<Call>(), delete: vi.fn<Call>() },
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

// jsdom can't play a video: the poster is a stand-in file.
vi.mock("../../utils/videoPoster", () => ({
  videoPoster: vi.fn<(file: File) => Promise<File>>(
    async (file) => new File(["poster"], `${file.name}-poster.jpg`, { type: "image/jpeg" }),
  ),
}));

const MEDIA = "https://api.test/api/v1/profiles/admin/812/media";

const item = (id: number, fields: Partial<PageMediaItem> = {}): PageMediaItem => ({
  id,
  kind: "image",
  source: "upload",
  url: `https://api.test/images/${id}.jpg`,
  thumbnail: null,
  embed_url: null,
  caption: null,
  alt: null,
  width: 800,
  height: 800,
  is_hidden: false,
  sort_order: id,
  from_card: false,
  created_at: "2026-11-03T10:00:00.000Z",
  ...fields,
});

/** The list as the API answers it, every item on one page. */
const answerList = (rows: PageMediaItem[]) =>
  vi.mocked(axios.get).mockResolvedValue({ data: { data: { count: rows.length, rows } } });

const refusal = (status: number, message: string, field?: string) => ({
  isAxiosError: true,
  response: { status, data: { success: false, status, message, code: "INVALID_PAGE", details: field ? { field } : undefined } },
});

const renderTab = (hasCard = true) => render(<MediaTab userId={812} hasCard={hasCard} />);

const tiles = () => screen.getAllByRole("listitem");
/** The tiles' pictures, in order. */
const pictures = () => [...document.querySelectorAll("li a img")].map((img) => img.getAttribute("src"));
const tile = (name: string) => screen.getByRole("listitem", { name });
const order = () => tiles().map((li) => li.getAttribute("aria-label"));

const photos = (n: number) => Array.from({ length: n }, (_, i) => new File(["x"], `photo-${i + 1}.jpg`, { type: "image/jpeg" }));

describe("A page's Media & Images", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists every item in order, marks the hidden ones and the first five that show on the page", async () => {
    answerList([
      item(1, { is_hidden: true, caption: "Hidden one" }),
      item(2),
      item(3, { from_card: true }),
      item(4, { kind: "video", source: "youtube", url: "https://www.youtube.com/watch?v=abc", thumbnail: "https://i.ytimg.com/vi/abc/hqdefault.jpg" }),
      item(5),
      item(6),
      item(7),
    ]);
    renderTab();

    await screen.findByRole("listitem", { name: "Photo 1" });
    expect(order()).toEqual(["Photo 1", "Photo 2", "Photo 3", "Video 4", "Photo 5", "Photo 6", "Photo 7"]);
    expect(axios.get).toHaveBeenCalledWith(MEDIA, { params: { page: 1, limit: 100 } });
    expect(screen.getByText(/7 items, 1 hidden/)).toBeInTheDocument();

    // Hidden: tagged, explained, and offered "Show"; not counted among the five on the page.
    const hidden = tile("Photo 1");
    expect(within(hidden).getByText("Hidden")).toBeInTheDocument();
    expect(within(hidden).getByText("Not on the page: hidden by an admin.")).toBeInTheDocument();
    expect(within(hidden).getByRole("button", { name: "Show photo 1" })).toBeInTheDocument();
    expect(within(hidden).queryByText("On the page")).not.toBeInTheDocument();
    expect(["Photo 2", "Photo 3", "Video 4", "Photo 5", "Photo 6"].every((name) => within(tile(name)).queryByText("On the page"))).toBe(true);
    expect(within(tile("Photo 7")).queryByText("On the page")).not.toBeInTheDocument();

    expect(within(tile("Photo 3")).getByText("From the Access card")).toBeInTheDocument();
    expect(within(tile("Video 4")).getByText("YouTube")).toBeInTheDocument();
    expect(tile("Video 4").querySelector("a img")).toHaveAttribute("src", "https://i.ytimg.com/vi/abc/hqdefault.jpg");
  });

  it("pages through the list until it has every item", async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { data: { count: 3, rows: [item(1), item(2)] } } })
      .mockResolvedValueOnce({ data: { data: { count: 3, rows: [item(3)] } } });
    renderTab();

    await screen.findByRole("listitem", { name: "Photo 3" });
    expect(axios.get).toHaveBeenNthCalledWith(2, MEDIA, { params: { page: 2, limit: 100 } });
    expect(order()).toEqual(["Photo 1", "Photo 2", "Photo 3"]);
  });

  it("explains the Access card's gallery and that there's no limit while the page has none", async () => {
    answerList([]);
    renderTab();

    expect(await screen.findByText("No media of its own yet.")).toBeInTheDocument();
    expect(screen.getByText(/Until some is added, the page shows its Access card's gallery/)).toBeInTheDocument();
    expect(screen.getByText(/There's no limit: add as many photos and videos as you like/)).toBeInTheDocument();
  });

  it("hides an item and shows it again", async () => {
    answerList([item(1), item(2)]);
    vi.mocked(axios.put).mockResolvedValueOnce({ data: { data: item(2, { is_hidden: true }) } });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: "Hide photo 2" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(`${MEDIA}/2`, { is_hidden: true }));
    expect(await within(tile("Photo 2")).findByText("Hidden")).toBeInTheDocument();

    vi.mocked(axios.put).mockResolvedValueOnce({ data: { data: item(2) } });
    const show = within(tile("Photo 2")).getByRole("button", { name: "Show photo 2" });
    await waitFor(() => expect(show).not.toHaveClass("ant-btn-loading"));
    fireEvent.click(show);
    await waitFor(() => expect(axios.put).toHaveBeenLastCalledWith(`${MEDIA}/2`, { is_hidden: false }));
    await waitFor(() => expect(within(tile("Photo 2")).queryByText("Hidden")).not.toBeInTheDocument());
  });

  it("saves a new order as every id, by the arrows or by dragging", async () => {
    answerList([item(1), item(2), item(3)]);
    vi.mocked(axios.put).mockResolvedValue({ data: { data: { ok: true } } });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: "Move photo 2 earlier" }));
    expect(order()).toEqual(["Photo 1", "Photo 2", "Photo 3"]); // named by place: the photo that was 2nd is now 1st
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(`${MEDIA}/order`, { ids: [2, 1, 3] }));
    expect(pictures()).toEqual([
      "https://api.test/images/2.jpg",
      "https://api.test/images/1.jpg",
      "https://api.test/images/3.jpg",
    ]);

    // Drag the last one onto the first.
    const dataTransfer = { setData: vi.fn<(format: string, data: string) => void>(), effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(tile("Photo 3"), { dataTransfer });
    fireEvent.dragOver(tile("Photo 1"), { dataTransfer });
    fireEvent.drop(tile("Photo 1"), { dataTransfer });
    await waitFor(() => expect(axios.put).toHaveBeenLastCalledWith(`${MEDIA}/order`, { ids: [3, 2, 1] }));
  });

  it("reloads the list when a new order isn't saved", async () => {
    answerList([item(1), item(2)]);
    vi.mocked(axios.put).mockRejectedValue(refusal(400, "ids lists every item once, in the new order.", "ids"));
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: "Move photo 2 earlier" }));

    expect(await screen.findByText("ids lists every item once, in the new order.")).toBeInTheDocument();
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(pictures()).toEqual(["https://api.test/images/1.jpg", "https://api.test/images/2.jpg"]),
    );
  });

  it("uploads photos at most 20 a request", async () => {
    answerList([]);
    vi.mocked(axios.post).mockResolvedValue({ data: { data: { rows: [] } } });
    renderTab();
    await screen.findByText("No media of its own yet.");

    fireEvent.change(screen.getByLabelText("Photos to upload"), { target: { files: photos(25) } });

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(axios.post).mock.calls;
    expect(first[0]).toBe(MEDIA);
    expect((first[1] as FormData).getAll("images")).toHaveLength(20);
    expect((second[1] as FormData).getAll("images")).toHaveLength(5);
    expect(await screen.findByText("25 photos added to the page")).toBeInTheDocument();
    // Then the list again, with the card's photos the first add copies in.
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  });

  it("uploads each MP4 on its own, with a poster made in the browser", async () => {
    answerList([]);
    vi.mocked(axios.post).mockResolvedValue({ data: { data: { rows: [] } } });
    renderTab();
    await screen.findByText("No media of its own yet.");

    fireEvent.change(screen.getByLabelText("MP4 videos to upload"), {
      target: {
        files: [
          new File(["v"], "one.mp4", { type: "video/mp4" }),
          new File(["v"], "two.mp4", { type: "video/mp4" }),
          new File(["v"], "three.mov", { type: "video/quicktime" }),
        ],
      },
    });

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
    vi.mocked(axios.post).mock.calls.forEach(([url, body], i) => {
      const form = body as FormData;
      expect(url).toBe(MEDIA);
      expect((form.get("videos") as File).name).toBe(["one.mp4", "two.mp4"][i]);
      expect(form.getAll("videos")).toHaveLength(1);
      expect((form.get("video_thumbnails") as File).name).toBe(`${["one.mp4", "two.mp4"][i]}-poster.jpg`);
    });
    expect(await screen.findByText("Videos must be MP4 files: the others were left out.")).toBeInTheDocument();
    expect(await screen.findByText("2 videos added to the page")).toBeInTheDocument();
  });

  it("adds a YouTube link, and imports the Access card's photos", async () => {
    answerList([]);
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { data: { rows: [item(9, { kind: "video", source: "youtube" })] } } })
      .mockResolvedValueOnce({ data: { data: { rows: [item(10), item(11)] } } });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: /Add a YouTube or Vimeo link/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Video link" }), { target: { value: "example.com/clip" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add video" }));
    expect(await within(dialog).findByText("Paste a link to a video on YouTube or Vimeo")).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Video link" }), { target: { value: "youtu.be/abc123" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Caption" }), { target: { value: " Our routine " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add video" }));
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(MEDIA, { url: "https://youtu.be/abc123", caption: "Our routine" }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Import Access card photos/ }));
    await waitFor(() => expect(axios.post).toHaveBeenLastCalledWith(`${MEDIA}/import-card`));
    expect(await screen.findByText("2 items copied from the Access card")).toBeInTheDocument();
  });

  it("can't import without a live Access card", async () => {
    answerList([]);
    renderTab(false);

    expect(await screen.findByText(/The page shows no Media & Images until some is added/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import Access card photos/ })).toBeDisabled();
  });

  it("edits the caption and alt text, and shows a refusal under its field", async () => {
    answerList([item(1, { caption: "Old caption" })]);
    vi.mocked(axios.put)
      .mockRejectedValueOnce(refusal(400, "alt is at most 255 characters.", "alt"))
      .mockResolvedValueOnce({ data: { data: item(1, { caption: "Before and after", alt: "A face, before and after" }) } });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: "Edit photo 1" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("textbox", { name: "Caption" })).toHaveValue("Old caption");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Caption" }), { target: { value: "Before and after " } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Alt text" }), { target: { value: "A face, before and after" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    // On the field, and in the message.
    await waitFor(() => expect(screen.getAllByText("alt is at most 255 characters.")).toHaveLength(2));
    expect(axios.put).toHaveBeenCalledWith(`${MEDIA}/1`, { caption: "Before and after", alt: "A face, before and after" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(tile("Photo 1")).findByText("Before and after")).toBeInTheDocument();
  });

  it("deletes an item only once confirmed", async () => {
    answerList([item(1), item(2, { from_card: true })]);
    vi.mocked(axios.delete).mockResolvedValue({ data: { data: { deleted: true } } });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: "Delete photo 2" }));
    // A card copy: the card keeps its own.
    expect(await screen.findByText("It comes off the page. The Access card keeps its own copy.")).toBeInTheDocument();
    expect(axios.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(`${MEDIA}/2`));
    await waitFor(() => expect(order()).toEqual(["Photo 1"]));
  });
});
