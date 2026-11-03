import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import EducationTab from "./EducationTab";
import type { PageEducationItem } from "../../types/profile";

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

// The editor stands in as a text box that says which mode it was given, and inserts a picture through `uploadMedia`.
vi.mock("../../components/RichTextEditor", () => ({
  default: ({
    value,
    onChange,
    article,
    uploadMedia,
  }: {
    value?: string;
    onChange?: (html: string) => void;
    article?: boolean;
    uploadMedia?: (file: File, options: object) => Promise<string>;
  }) => (
    <div>
      <textarea aria-label={article ? "Article text" : "Text"} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} />
      <button
        type="button"
        onClick={async () => {
          const src = await uploadMedia?.(new File(["x"], "inside.jpg", { type: "image/jpeg" }), {});
          onChange?.(`${value ?? ""}<img src="${src}">`);
        }}
      >
        Insert picture
      </button>
    </div>
  ),
}));

// The cover's upload stands in as two buttons.
vi.mock("../../components/ImageUploadField", () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (link: string) => void }) => (
    <div>
      <span>{value ? `Cover: ${value}` : "No cover"}</span>
      <button type="button" onClick={() => onChange?.("https://api.test/images/new-cover.jpg")}>
        Upload cover
      </button>
      <button type="button" onClick={() => onChange?.("")}>
        Remove cover
      </button>
    </div>
  ),
}));

const EDUCATION = "https://api.test/api/v1/profiles/admin/812/education";

const post = (id: number, fields: Partial<PageEducationItem> = {}): PageEducationItem => ({
  id,
  slug: `post-${id}`,
  kind: "article",
  title: `Post ${id}`,
  summary: null,
  cover_image: null,
  video: null,
  published_at: "2026-11-01T10:00:00.000Z",
  status: "published",
  sort_order: id,
  created_at: "2026-11-01T10:00:00.000Z",
  updated_at: "2026-11-02T10:00:00.000Z",
  ...fields,
});

const youtube = {
  source: "youtube" as const,
  url: "https://www.youtube.com/watch?v=abc",
  embed_url: "https://www.youtube.com/embed/abc",
  thumbnail: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  duration_seconds: null,
};

/** Answers each GET by its path under the API. */
const answerGets = (routes: Record<string, unknown>) => {
  vi.mocked(axios.get).mockImplementation((url) => {
    const path = String(url).replace("https://api.test/api/v1/profiles/admin/812/", "");
    return path in routes
      ? Promise.resolve({ data: { success: true, data: routes[path] } })
      : Promise.reject(new Error(`No answer for GET ${path}`));
  });
};

const list = (rows: PageEducationItem[]) => ({ count: rows.length, rows });

const refusal = (message: string, field: string) => ({
  isAxiosError: true,
  response: { status: 400, data: { success: false, status: 400, message, code: "INVALID_PAGE", details: { field } } },
});

const renderTab = (page = { slug: "revance", visible: true }) => render(<EducationTab userId={812} page={page} />);

const row = (title: string) => screen.getByRole("listitem", { name: title });
const titles = () => screen.getAllByRole("listitem").map((li) => li.getAttribute("aria-label"));

/** What a form request sent, files by name. */
const sent = (call: unknown[] | undefined) => {
  const form = call?.[1];
  if (!(form instanceof FormData)) throw new Error("The request sent no form");
  return Object.fromEntries(
    [...form.entries()].map(([key, value]) => [key, value instanceof File ? `file:${value.name}` : value]),
  );
};

describe("A page's Education: the list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists posts with their status and date, links published ones to the site, and saves a new order", async () => {
    answerGets({
      education: list([
        post(1, { title: "Winter skin", slug: "winter-skin" }),
        post(2, { title: "Lash lift how-to", kind: "video", video: youtube, status: "draft", published_at: null }),
        post(3, { title: "Brows", kind: "video", video: youtube, cover_image: youtube.thumbnail }),
      ]),
    });
    vi.mocked(axios.put).mockResolvedValue({ data: { data: { ok: true } } });
    renderTab();

    await screen.findByRole("listitem", { name: "Winter skin" });
    expect(axios.get).toHaveBeenCalledWith(EDUCATION, { params: { page: 1, limit: 100 } });
    expect(titles()).toEqual(["Winter skin", "Lash lift how-to", "Brows"]);
    expect(screen.getByText(/3 posts, 1 draft/)).toBeInTheDocument();

    const published = row("Winter skin");
    expect(within(published).getByText("Published")).toBeInTheDocument();
    expect(within(published).getByText("Published Nov 1, 2026")).toBeInTheDocument();
    expect(within(published).getByText("On the page")).toBeInTheDocument();
    expect(within(published).getByRole("link", { name: /View on site/ })).toHaveAttribute(
      "href",
      "https://glamlink.net/profiles/revance/education/winter-skin",
    );
    expect(within(published).getByRole("button", { name: "Unpublish “Winter skin”" })).toBeInTheDocument();

    const draft = row("Lash lift how-to");
    expect(within(draft).getByText("Draft")).toBeInTheDocument();
    expect(within(draft).getByText("Draft, last changed Nov 2, 2026")).toBeInTheDocument();
    expect(within(draft).queryByRole("link", { name: /View on site/ })).not.toBeInTheDocument();
    expect(within(draft).queryByText("On the page")).not.toBeInTheDocument();
    expect(within(draft).getByText("Video")).toBeInTheDocument();

    fireEvent.click(within(draft).getByRole("button", { name: "Move “Lash lift how-to” up" }));
    expect(titles()).toEqual(["Lash lift how-to", "Winter skin", "Brows"]);
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(`${EDUCATION}/order`, { ids: [2, 1, 3] }));
  });

  it("links nowhere while the website doesn't show the page", async () => {
    answerGets({ education: list([post(1, { title: "Winter skin" })]) });
    renderTab({ slug: "revance", visible: false });

    await screen.findByRole("listitem", { name: "Winter skin" });
    expect(screen.queryByRole("link", { name: /View on site/ })).not.toBeInTheDocument();
    expect(screen.getByText(/The page isn't on the website/)).toBeInTheDocument();
  });

  it("unpublishes and publishes a post, and says why an article can't be published", async () => {
    answerGets({ education: list([post(1, { title: "Winter skin" })]) });
    vi.mocked(axios.put)
      .mockResolvedValueOnce({ data: { data: post(1, { title: "Winter skin", status: "draft" }) } })
      .mockRejectedValueOnce(refusal("Write the article before publishing it.", "body"));
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: "Unpublish “Winter skin”" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(`${EDUCATION}/1`, { status: "draft" }));
    const publish = await within(row("Winter skin")).findByRole("button", { name: "Publish “Winter skin”" });
    expect(within(row("Winter skin")).getByText("Draft")).toBeInTheDocument();

    await waitFor(() => expect(publish).not.toHaveClass("ant-btn-loading"));
    fireEvent.click(publish);
    await waitFor(() => expect(axios.put).toHaveBeenLastCalledWith(`${EDUCATION}/1`, { status: "published" }));
    expect(await screen.findByText("Write the article before publishing it.")).toBeInTheDocument();
    expect(within(row("Winter skin")).getByText("Draft")).toBeInTheDocument();
  });

  it("deletes a post only once confirmed", async () => {
    answerGets({ education: list([post(1, { title: "Winter skin" }), post(2, { title: "Brows" })]) });
    vi.mocked(axios.delete).mockResolvedValue({ data: { data: { deleted: true } } });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: "Delete “Brows”" }));
    expect(await screen.findByText("Delete “Brows”?")).toBeInTheDocument();
    expect(axios.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(`${EDUCATION}/2`));
    await waitFor(() => expect(titles()).toEqual(["Winter skin"]));
  });
});

describe("A page's Education: adding and editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn<(object: Blob | MediaSource) => string>(() => "blob:poster");
    URL.revokeObjectURL = vi.fn<(url: string) => void>();
  });

  it("adds a video by its YouTube link, and shows a refusal under the link", async () => {
    answerGets({ education: list([]) });
    vi.mocked(axios.post)
      .mockRejectedValueOnce(refusal("video_url must be a YouTube or Vimeo link.", "video_url"))
      .mockResolvedValueOnce({ data: { data: post(5, { kind: "video", video: youtube }) } });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: /Add a post/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: " Lash lift how-to " } });
    fireEvent.change(screen.getByRole("textbox", { name: "Summary" }), { target: { value: "Step by step" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Video link" }), { target: { value: "youtube.com/watch?v=abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));

    await waitFor(() => expect(screen.getAllByText("video_url must be a YouTube or Vimeo link.")).toHaveLength(2));
    expect(vi.mocked(axios.post).mock.calls[0][0]).toBe(EDUCATION);
    expect(sent(vi.mocked(axios.post).mock.calls[0])).toEqual({
      kind: "video",
      title: "Lash lift how-to",
      summary: "Step by step",
      status: "published",
      video_url: "https://youtube.com/watch?v=abc",
    });

    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
    expect(await screen.findByText("Post published on the page")).toBeInTheDocument();
    // Back to the list, loaded again.
    await waitFor(() => expect(vi.mocked(axios.get).mock.calls.filter(([url]) => url === EDUCATION)).toHaveLength(2));
  });

  it("adds an MP4 with a poster made in the browser, and a cover", async () => {
    answerGets({ education: list([]) });
    vi.mocked(axios.post).mockResolvedValue({ data: { data: post(5, { kind: "video" }) } });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: /Add a post/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Brow mapping" } });
    fireEvent.click(screen.getByRole("radio", { name: "Upload an MP4" }));
    await screen.findByRole("button", { name: /Choose an MP4/ });
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
    expect(await screen.findByText("Choose an MP4 video")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("MP4 video"), {
      target: { files: [new File(["v"], "brows.mp4", { type: "video/mp4" })] },
    });
    expect(await screen.findByText(/brows\.mp4 .* Its poster is a frame from it\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload cover" }));
    fireEvent.click(screen.getByRole("radio", { name: "Draft: only here" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(sent(vi.mocked(axios.post).mock.lastCall)).toEqual({
      kind: "video",
      title: "Brow mapping",
      summary: "",
      status: "draft",
      videos: "file:brows.mp4",
      video_thumbnails: "file:brows.mp4-poster.jpg",
      cover_image: "https://api.test/images/new-cover.jpg",
    });
  });

  it("asks for an article's text before publishing it, and saves a draft without", async () => {
    answerGets({ education: list([]) });
    vi.mocked(axios.post).mockResolvedValue({ data: { data: post(5, { status: "draft" }) } });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: /Add a post/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Article" }));
    await screen.findByRole("textbox", { name: "Article text" });
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Winter skin" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));

    expect(await screen.findByText("Write the article before publishing it, or save it as a draft")).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "Draft: only here" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(sent(vi.mocked(axios.post).mock.lastCall)).toEqual({
      kind: "article",
      title: "Winter skin",
      summary: "",
      status: "draft",
      body: "",
    });
  });

  it("writes an article in the editor's article mode, its pictures uploaded to the page", async () => {
    answerGets({ education: list([]) });
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { data: { location: "https://api.test/images/inside.jpg" } } })
      .mockResolvedValueOnce({ data: { data: post(5) } });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: /Add a post/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Article" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Winter skin" } });
    fireEvent.change(await screen.findByRole("textbox", { name: "Article text" }), {
      target: { value: "<h2>Why</h2><p>Dry air.</p>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Insert picture" }));

    await waitFor(() =>
      expect(vi.mocked(axios.post).mock.calls[0][0]).toBe("https://api.test/api/v1/profiles/admin/812/uploads"),
    );
    expect((vi.mocked(axios.post).mock.calls[0][1] as FormData).get("images")).toBeInstanceOf(File);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Article text" })).toHaveValue(
        '<h2>Why</h2><p>Dry air.</p><img src="https://api.test/images/inside.jpg">',
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
    expect(sent(vi.mocked(axios.post).mock.lastCall)).toMatchObject({
      kind: "article",
      status: "published",
      body: '<h2>Why</h2><p>Dry air.</p><img src="https://api.test/images/inside.jpg">',
    });
  });

  it("edits an article from its own call, sending its text only once changed", async () => {
    const article = post(1, { title: "Winter skin", cover_image: "https://api.test/images/cover.jpg" });
    answerGets({ education: list([article]), "education/1": { ...article, body: "<p>Dry air.</p>" } });
    vi.mocked(axios.put).mockResolvedValue({ data: { data: article } });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: "Edit “Winter skin”" }));
    const text = await screen.findByRole("textbox", { name: "Article text" });
    expect(text).toHaveValue("<p>Dry air.</p>");
    expect(screen.getByText("Cover: https://api.test/images/cover.jpg")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Winter skin care" } });
    fireEvent.click(screen.getByRole("button", { name: "Save post" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    expect(vi.mocked(axios.put).mock.lastCall?.[0]).toBe(`${EDUCATION}/1`);
    // No text, no video, no cover: they didn't change.
    expect(sent(vi.mocked(axios.put).mock.lastCall)).toEqual({
      kind: "article",
      title: "Winter skin care",
      summary: "",
      status: "published",
    });

    fireEvent.click(await screen.findByRole("button", { name: "Edit “Winter skin”" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Article text" }), {
      target: { value: "<p>Dry air, and the heating.</p>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove cover" }));
    fireEvent.click(screen.getByRole("button", { name: "Save post" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(2));
    expect(sent(vi.mocked(axios.put).mock.lastCall)).toMatchObject({
      body: "<p>Dry air, and the heating.</p>",
      cover_image: "",
    });
  });

  it("keeps an uploaded video when an edit doesn't replace it", async () => {
    const video = post(2, {
      title: "Brow mapping",
      kind: "video",
      video: { ...youtube, source: "upload", url: "https://api.test/videos/brows.mp4", thumbnail: "https://api.test/images/poster.jpg" },
      cover_image: "https://api.test/images/poster.jpg",
    });
    answerGets({ education: list([video]), "education/2": { ...video, body: null } });
    vi.mocked(axios.put).mockResolvedValue({ data: { data: video } });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: "Edit “Brow mapping”" }));
    expect(await screen.findByText("The current video stays unless another is chosen.")).toBeInTheDocument();
    // The poster isn't the post's own cover.
    expect(screen.getByText("No cover")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Summary" }), { target: { value: "Where brows start and end" } });
    fireEvent.click(screen.getByRole("button", { name: "Save post" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    expect(sent(vi.mocked(axios.put).mock.lastCall)).toEqual({
      kind: "video",
      title: "Brow mapping",
      summary: "Where brows start and end",
      status: "published",
    });
  });
});
