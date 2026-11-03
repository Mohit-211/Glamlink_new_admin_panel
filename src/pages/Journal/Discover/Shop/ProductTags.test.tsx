import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import axios from "axios";
import ProductTags from "./ProductTags";
import type { ProductTag } from "../../../../types/productTag";

// No network in tests: each test says what the API answers.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), post: vi.fn<Call>(), put: vi.fn<Call>(), delete: vi.fn<Call>() },
    // utils/apiError reads failures through this.
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const TAGS = "https://api.test/api/v1/discover/shop/tags";

const tag = (id: number, name: string, is_editorial = false): ProductTag => ({ id, name, is_editorial, sort_order: id });

// As the backend seeds them.
const SEEDED = [
  tag(1, "Featured in The Beauty Vault", true),
  tag(2, "Editor's Pick", true),
  tag(3, "Pro Favorite"),
  tag(4, "New"),
  tag(5, "Best Seller"),
];

const answer = (rows: ProductTag[]) => vi.mocked(axios.get).mockResolvedValue({ data: { success: true, data: rows } });

const listCalls = () => vi.mocked(axios.get).mock.calls.filter(([url]) => url === TAGS);

const refusal = (status: number, code: string, message: string, field?: string) => ({
  isAxiosError: true,
  response: { status, data: { success: false, status, message, code, ...(field ? { details: { field } } : {}) } },
});

// PageHeader can navigate, so the page needs a router.
const renderTags = () =>
  render(
    <MemoryRouter>
      <ProductTags />
    </MemoryRouter>,
  );

const row = (name: string) => screen.getByRole("row", { name });

/** The tags' names, in the list's order. */
const names = () =>
  screen
    .getAllByRole("row")
    .map((tr) => tr.getAttribute("aria-label"))
    .filter(Boolean);

const openAddDialog = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Add a tag/ }));
  return screen.findByRole("dialog", { name: "Add a tag" });
};

describe("Product tags", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists the tags in their order with the Editorial switch, and says what editorial means", async () => {
    answer(SEEDED);
    renderTags();

    expect(await screen.findByRole("row", { name: "Best Seller" })).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(TAGS);
    expect(names()).toEqual(["Featured in The Beauty Vault", "Editor's Pick", "Pro Favorite", "New", "Best Seller"]);
    expect(within(row("Editor's Pick")).getByRole("switch", { name: "“Editor's Pick” is editorial" })).toBeChecked();
    expect(within(row("New")).getByRole("switch", { name: "“New” is editorial" })).not.toBeChecked();
    expect(
      screen.getByText(/Editorial: only admins can set it, so owners can't claim a feature they didn't get\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/5 tags, in the order the product forms offer them/)).toBeInTheDocument();
    // The first can't go up, the last can't go down.
    expect(screen.getByRole("button", { name: "Move “Featured in The Beauty Vault” up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move “Best Seller” down" })).toBeDisabled();
  });

  it("says when the tags can't be loaded, and tries again", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(refusal(500, "INTERNAL", "An internal server error occurred."));
    answer(SEEDED);
    renderTags();

    expect(await screen.findByText("An internal server error occurred.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("row", { name: "New" })).toBeInTheDocument();
    expect(listCalls()).toHaveLength(2);
  });

  it("adds a tag, and shows a name another tag has (409 TAG_EXISTS) on the name field", async () => {
    answer(SEEDED);
    vi.mocked(axios.post)
      .mockRejectedValueOnce(refusal(409, "TAG_EXISTS", "There's already a tag called “New”."))
      .mockResolvedValueOnce({ data: { data: tag(6, "Gift Idea", true) } });
    renderTags();
    await screen.findByRole("row", { name: "New" });

    const dialog = await openAddDialog();
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    fireEvent.change(name, { target: { value: "new" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add tag" }));

    // On the field, and in the message.
    await waitFor(() => expect(screen.getAllByText("There's already a tag called “New”.")).toHaveLength(2));
    expect(axios.post).toHaveBeenCalledWith(TAGS, { name: "new", is_editorial: false });
    expect(listCalls()).toHaveLength(1);

    answer([...SEEDED, tag(6, "Gift Idea", true)]);
    fireEvent.change(name, { target: { value: " Gift Idea " } });
    fireEvent.click(within(dialog).getByRole("switch", { name: "Editorial" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add tag" }));

    await waitFor(() => expect(axios.post).toHaveBeenLastCalledWith(TAGS, { name: "Gift Idea", is_editorial: true }));
    // The list comes again, with the new tag where the API put it.
    expect(await screen.findByRole("row", { name: "Gift Idea" })).toBeInTheDocument();
    expect(listCalls()).toHaveLength(2);
  });

  it("asks for a name of at most 40 characters before sending it", async () => {
    answer(SEEDED);
    renderTags();
    await screen.findByRole("row", { name: "New" });

    const dialog = await openAddDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add tag" }));
    expect(await within(dialog).findByText("Give the tag a name")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), { target: { value: "x".repeat(41) } });
    expect(await within(dialog).findByText("At most 40 characters")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add tag" }));
    await waitFor(() => expect(within(dialog).getByText("At most 40 characters")).toBeInTheDocument());
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("renames a tag, and shows a refused name (400 INVALID_TAG) on the name field", async () => {
    answer(SEEDED);
    vi.mocked(axios.put)
      .mockRejectedValueOnce(refusal(400, "INVALID_TAG", "That name can't be used.", "name"))
      .mockResolvedValueOnce({ data: { data: tag(3, "Pro Pick") } });
    renderTags();

    fireEvent.click(await screen.findByRole("button", { name: "Rename “Pro Favorite”" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename “Pro Favorite”" });
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("Pro Favorite");
    // Only the name: the list's switch says whether it's editorial.
    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument();

    fireEvent.change(name, { target: { value: "Pro Pick" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(screen.getAllByText("That name can't be used.")).toHaveLength(2));
    expect(axios.put).toHaveBeenCalledWith(`${TAGS}/3`, { name: "Pro Pick" });

    answer(SEEDED.map((t) => (t.id === 3 ? tag(3, "Pro Pick") : t)));
    fireEvent.change(name, { target: { value: "Pro Pick " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(2));
    expect(axios.put).toHaveBeenLastCalledWith(`${TAGS}/3`, { name: "Pro Pick" });
    expect(await screen.findByRole("row", { name: "Pro Pick" })).toBeInTheDocument();
    expect(names()).toEqual(["Featured in The Beauty Vault", "Editor's Pick", "Pro Pick", "New", "Best Seller"]);
  });

  it("makes a tag editorial with its switch, and reloads when the tag is gone", async () => {
    answer(SEEDED);
    vi.mocked(axios.put)
      .mockResolvedValueOnce({ data: { data: tag(4, "New", true) } })
      .mockRejectedValueOnce(refusal(404, "NOT_FOUND", "No such tag."));
    renderTags();

    fireEvent.click(await screen.findByRole("switch", { name: "“New” is editorial" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(`${TAGS}/4`, { is_editorial: true }));
    expect(await screen.findByText("“New” is editorial: only admins can set it")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("switch", { name: "“New” is editorial" })).toBeChecked());

    // Deleted meanwhile: the switch stays as it was and the list comes again.
    fireEvent.click(screen.getByRole("switch", { name: "“Editor's Pick” is editorial" }));
    await waitFor(() => expect(axios.put).toHaveBeenLastCalledWith(`${TAGS}/2`, { is_editorial: false }));
    expect(await screen.findByText("No such tag.")).toBeInTheDocument();
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    expect(screen.getByRole("switch", { name: "“Editor's Pick” is editorial" })).toBeChecked();
  });

  it("saves the whole order, by the arrows or by dragging", async () => {
    answer(SEEDED);
    vi.mocked(axios.put).mockResolvedValue({ data: { data: { ok: true } } });
    renderTags();

    fireEvent.click(await screen.findByRole("button", { name: "Move “Editor's Pick” up" }));
    expect(names()).toEqual(["Editor's Pick", "Featured in The Beauty Vault", "Pro Favorite", "New", "Best Seller"]);
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(`${TAGS}/order`, { ids: [2, 1, 3, 4, 5] }));
    expect(await screen.findByText("Order saved")).toBeInTheDocument();

    // Drag the last one onto the first.
    const dataTransfer = { setData: vi.fn<(format: string, data: string) => void>(), effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(row("Best Seller"), { dataTransfer });
    fireEvent.dragOver(row("Editor's Pick"), { dataTransfer });
    fireEvent.drop(row("Editor's Pick"), { dataTransfer });
    expect(names()).toEqual(["Best Seller", "Editor's Pick", "Featured in The Beauty Vault", "Pro Favorite", "New"]);
    await waitFor(() => expect(axios.put).toHaveBeenLastCalledWith(`${TAGS}/order`, { ids: [5, 2, 1, 3, 4] }));
  });

  it("goes back to the order the API kept when a new one isn't saved", async () => {
    answer(SEEDED);
    vi.mocked(axios.put).mockRejectedValue(refusal(400, "INVALID_TAG", "ids must list every tag once.", "ids"));
    renderTags();

    fireEvent.click(await screen.findByRole("button", { name: "Move “New” down" }));
    expect(names()).toEqual(["Featured in The Beauty Vault", "Editor's Pick", "Pro Favorite", "Best Seller", "New"]);
    expect(await screen.findByText("ids must list every tag once.")).toBeInTheDocument();
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    await waitFor(() => expect(names()).toEqual(SEEDED.map((t) => t.name)));
  });

  it("deletes a tag only once confirmed, saying the products carrying it lose it", async () => {
    answer(SEEDED);
    vi.mocked(axios.delete).mockResolvedValue({ data: { data: { id: 4, products_untagged: 3 } } });
    renderTags();

    fireEvent.click(await screen.findByRole("button", { name: "Delete “New”" }));
    expect(await screen.findByText("Delete “New”?")).toBeInTheDocument();
    expect(
      screen.getByText("The products that carry it lose the tag; the products themselves stay."),
    ).toBeInTheDocument();
    expect(axios.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(`${TAGS}/4`));
    expect(await screen.findByText("“New” is deleted; 3 products lost it")).toBeInTheDocument();
    expect(names()).toEqual(["Featured in The Beauty Vault", "Editor's Pick", "Pro Favorite", "Best Seller"]);
  });
});
