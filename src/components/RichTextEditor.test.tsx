import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import RichTextEditor, { type UploadMediaOptions } from "./RichTextEditor";
import { answerFilePicker, loadCropPicture, mockCanvas, mockFetchImage, mockObjectUrls } from "./ImageCropDialog.testing";

const journalHtml =
  '<p class="topic-tagged-paragraph" data-paragraph-id="para_1" data-topic-ids="3" data-topic-names="Facelift">Tagged</p>' +
  '<p>See <a href="https://glamlink.net/access-card/luxe" target="_blank" rel="noopener noreferrer" class="mention-tag" data-card-id="42">@luxe</a></p>';

const topics = [
  { id: 3, name: "Facelift" },
  { id: 7, name: "Botox" },
];
const fullProps = {
  full: true,
  uploadMedia: async () => "https://cdn.example.com/file",
  mentions: { search: () => [], toLink: () => null },
  topics,
};

describe("RichTextEditor", () => {
  it("shows font and media tools only in full mode", () => {
    const { container, unmount } = render(<RichTextEditor value="<p>Hi</p>" onChange={() => {}} />);
    expect(container.querySelector(".ProseMirror")).toHaveTextContent("Hi");
    expect(container.querySelectorAll(".rte__toolbar .ant-select")).toHaveLength(1); // block type only
    expect(screen.queryByRole("button", { name: /topic/i })).not.toBeInTheDocument();
    unmount();

    const full = render(<RichTextEditor {...fullProps} value="" onChange={() => {}} />);
    expect(full.container.querySelectorAll(".rte__toolbar .ant-select")).toHaveLength(3); // block, font, size
    expect(screen.getByRole("button", { name: /topic/i })).toBeInTheDocument();
  });

  it("shows content that arrives after mount without reporting a change", () => {
    const onChange = vi.fn<(html: string) => void>();
    const { container, rerender } = render(<RichTextEditor {...fullProps} value="" onChange={onChange} />);
    rerender(<RichTextEditor {...fullProps} value={journalHtml} onChange={onChange} />);

    const doc = container.querySelector(".ProseMirror")!;
    expect(doc.querySelector('p.topic-tagged-paragraph[data-topic-ids="3"]')).toBeInTheDocument();
    expect(doc.querySelector('a.mention-tag[data-card-id="42"]')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("tags the paragraph at the cursor with the topics picked in the dialog", async () => {
    const onChange = vi.fn<(html: string) => void>();
    render(<RichTextEditor {...fullProps} value="<p>Untagged paragraph</p>" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /topic/i }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Botox" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const html = onChange.mock.calls.at(-1)![0];
    const root = document.createElement("div");
    root.innerHTML = html;
    const p = root.querySelector("p");
    expect(p).toHaveClass("topic-tagged-paragraph");
    expect(p).toHaveAttribute("data-topic-ids", "7");
    expect(p).toHaveAttribute("data-topic-names", "Botox");
    expect(p?.getAttribute("data-paragraph-id")).toMatch(/^para_/);
  });

  it("offers only the website's formatting in simple mode, with a character count", () => {
    render(<RichTextEditor simple maxLength={80} value="<p>Hello <strong>there</strong></p>" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /strikethrough/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /table/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /html source/i })).not.toBeInTheDocument();
    expect(screen.getByText("11 / 80 characters")).toBeInTheDocument();
  });

  it("offers only an education article's formatting in article mode, and keeps only that", async () => {
    const loaded =
      '<h1>Title</h1><h5>Step</h5><p><u>Under</u> <s>struck</s> <span style="color: red">red</span> <strong>bold</strong></p>' +
      "<table><tbody><tr><td>Cell</td></tr></tbody></table>";
    const { container } = render(
      <RichTextEditor article full simple {...{ topics, uploadMedia: fullProps.uploadMedia }} value={loaded} onChange={() => {}} />,
    );

    // Toolbar buttons are named by their icons.
    for (const name of ["bold", "italic", "unordered-list", "ordered-list", "link", "picture"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    for (const name of ["underline", "strikethrough", "table", "code", "video-camera-add", "font-colors", "align-left", "fullscreen"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /topic/i })).not.toBeInTheDocument();
    expect(container.querySelectorAll(".rte__toolbar .ant-select")).toHaveLength(1);

    fireEvent.mouseDown(screen.getByRole("combobox"));
    await screen.findByTitle("Heading 2");
    const options = [...document.querySelectorAll(".ant-select-item-option")].map((o) => o.textContent);
    expect(options).toEqual(["Paragraph", "Heading 2", "Heading 3"]);

    // h1 and h4-h6 become h2 and h3, as the API does; other markup goes and its text stays.
    const doc = container.querySelector(".ProseMirror")!;
    expect(doc.querySelector("h2")).toHaveTextContent("Title");
    expect(doc.querySelector("h3")).toHaveTextContent("Step");
    expect(doc.querySelector("strong")).toHaveTextContent("bold");
    expect(doc.querySelector("h1, h5, u, s, span[style], table")).toBeNull();
    expect(doc).toHaveTextContent("Under struck red bold");
    expect(doc).toHaveTextContent("Cell");
  });

  it("drops scripts and unsafe embeds from loaded content", () => {
    const hostile =
      '<p>Hi<img src="x" onerror="steal()"></p>' +
      '<p><iframe src="javascript:steal()"></iframe><iframe src="https://www.youtube.com/embed/abc"></iframe></p>' +
      '<p><a href="javascript:steal()">link</a></p>';
    const { container } = render(<RichTextEditor value={hostile} onChange={() => {}} />);

    const doc = container.querySelector(".ProseMirror")!;
    expect(doc.innerHTML).not.toMatch(/onerror|javascript:/i);
    const frames = doc.querySelectorAll("iframe");
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveAttribute("src", "https://www.youtube.com/embed/abc");
  });
});

describe("RichTextEditor pictures", () => {
  const photo = (name: string, type = "image/jpeg") => new File(["raw"], name, { type });
  const setup = (value: string, mode: "article" | "full" = "article") => {
    mockObjectUrls();
    const canvas = mockCanvas();
    const uploadMedia = vi.fn<(file: File, options: UploadMediaOptions) => Promise<string>>(
      async (file) => `https://cdn.example.com/up/${file.name}`,
    );
    const onChange = vi.fn<(html: string) => void>();
    const view = render(<RichTextEditor {...{ [mode]: true }} value={value} onChange={onChange} uploadMedia={uploadMedia} />);
    const editor = (view.container.querySelector(".ProseMirror") as HTMLElement & { editor: Editor }).editor;
    const images = () => {
      const root = document.createElement("div");
      root.innerHTML = onChange.mock.calls.at(-1)?.[0] ?? "";
      return [...root.querySelectorAll("img")];
    };
    return { ...view, canvas, uploadMedia, onChange, editor, images };
  };

  it("crops a picture from the toolbar before it is uploaded and inserted", async () => {
    const { uploadMedia, images } = setup("<p>Text</p>");
    const original = photo("photo.jpg");
    answerFilePicker([original]);
    fireEvent.click(screen.getByRole("button", { name: "picture" }));
    await loadCropPicture(4000, 3000);

    expect(screen.getByRole("radio", { name: "Original" })).toBeChecked();
    for (const name of ["16:9", "4:3", "1:1", "4:5", "Free", "Custom"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("radio", { name: "4:5" }));
    expect(screen.getByText("Result: 2400 × 3000 px")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));

    await waitFor(() => expect(images()).toHaveLength(1));
    const sent = uploadMedia.mock.calls[0][0];
    expect(sent).not.toBe(original);
    expect(sent).toMatchObject({ name: "photo.jpg", type: "image/jpeg" });
    expect(images()[0]).toHaveAttribute("src", "https://cdn.example.com/up/photo.jpg");
  });

  it("inserts nothing when the crop is cancelled", async () => {
    const { uploadMedia, onChange } = setup("<p>Text</p>");
    answerFilePicker([photo("photo.jpg")]);
    fireEvent.click(screen.getByRole("button", { name: "picture" }));
    await loadCropPicture(1200, 800);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText("Crop picture")).toBeNull());
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("takes pasted pictures one after another, with Use as is for the rest", async () => {
    const { container, uploadMedia, images } = setup("<p>Text</p>", "full");
    const files = [photo("a.jpg"), photo("b.png", "image/png"), photo("c.webp", "image/webp")];
    fireEvent.paste(container.querySelector(".ProseMirror")!, { clipboardData: { files, getData: () => "" } });

    expect(await screen.findByText("Crop picture (1 of 3)")).toBeInTheDocument();
    await loadCropPicture(1200, 800);
    fireEvent.click(screen.getByRole("button", { name: "Use as is for the rest" }));

    await waitFor(() => expect(images()).toHaveLength(3));
    expect(uploadMedia.mock.calls.map(([file]) => file)).toEqual(files);
    expect(images().map((img) => img.getAttribute("src"))).toEqual([
      "https://cdn.example.com/up/a.jpg",
      "https://cdn.example.com/up/b.png",
      "https://cdn.example.com/up/c.webp",
    ]);
  });

  it("crops a picture already in the text from the stored file, keeping its alt and width", async () => {
    const { editor, uploadMedia, images } = setup(
      '<p>Hi <img src="https://cdn.example.com/a.jpg" alt="A cat" width="300" height="200"></p>',
      "full",
    );
    const fetch = mockFetchImage("image/jpeg");
    const crop = screen.getByRole("button", { name: "scissor" });
    expect(crop).toBeDisabled();
    act(() => {
      editor.commands.setNodeSelection(4); // the picture, after "Hi "
    });
    expect(crop).toBeEnabled();

    fireEvent.click(crop);
    await loadCropPicture(1200, 800);
    expect(fetch).toHaveBeenCalledWith("https://cdn.example.com/a.jpg", expect.objectContaining({ mode: "cors", cache: "reload" }));
    expect(screen.queryByRole("button", { name: "Use as is" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "1:1" }));
    fireEvent.click(screen.getByRole("button", { name: "Crop" }));

    await waitFor(() => expect(images()).toHaveLength(1));
    expect(uploadMedia).toHaveBeenCalledTimes(1);
    expect(uploadMedia.mock.calls[0][0]).toMatchObject({ name: "a.jpg", type: "image/jpeg" });
    const img = images()[0];
    expect(img).toHaveAttribute("src", "https://cdn.example.com/up/a.jpg");
    expect(img).toHaveAttribute("alt", "A cat");
    expect(img).toHaveAttribute("width", "300");
    expect(img).toHaveAttribute("height", "300"); // follows the square crop
  });

  it("leaves a picture alone when its crop is cancelled", async () => {
    const { editor, uploadMedia, onChange } = setup('<p><img src="https://cdn.example.com/a.jpg" alt="A cat"></p>', "full");
    mockFetchImage();
    act(() => {
      editor.commands.setNodeSelection(1);
    });
    fireEvent.click(screen.getByRole("button", { name: "scissor" }));
    await loadCropPicture(1200, 800);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText("Crop picture")).toBeNull());
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(editor.getHTML()).toContain('src="https://cdn.example.com/a.jpg"');
  });
});
