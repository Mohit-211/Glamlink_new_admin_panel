import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import EditShop from "./EditShop";
import { PRODUCT_CATEGORIES } from "./ProductSiteFields";
import type { Shop } from "../../../../types/journal";
import type { ProductTag } from "../../../../types/productTag";

// No network in tests: the product below, the tag list, and no topics.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), put: vi.fn<Call>() },
    // utils/apiError reads failures through this.
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const API = "https://api.test/api/v1/";

const tag = (id: number, name: string, is_editorial = false): ProductTag => ({ id, name, is_editorial, sort_order: id });

const TAGS = [
  tag(1, "Featured in The Beauty Vault", true),
  tag(2, "Editor's Pick", true),
  tag(3, "Pro Favorite"),
  tag(4, "New"),
  tag(5, "Best Seller"),
];

const EDITORS_PICK = { id: 2, name: "Editor's Pick", is_editorial: true };

const saved = (fields: Partial<Shop>): Shop => ({
  id: 7,
  title: "Glow Serum",
  short_description: "A light vitamin C serum.",
  brand: "Lumen Labs",
  price: "38.00",
  link: "https://shop.example/glow-serum",
  status: "published",
  slug: "glow-serum",
  ...fields,
});

/** Answers the product and the tag list (or fails it), and no topics. */
const renderEdit = (product: Shop, tags: ProductTag[] | Error = TAGS) => {
  vi.mocked(axios.get).mockImplementation(async (url) => {
    const path = String(url).replace(API, "");
    if (path === `discover/shop/findById/${product.id}`) return { data: { success: true, data: product } };
    if (path === "discover/shop/tags") {
      if (tags instanceof Error) throw tags;
      return { data: { success: true, data: tags } };
    }
    return { data: { data: [], rows: [] } };
  });
  vi.mocked(axios.put).mockResolvedValue({ data: { data: product } });
  render(
    <MemoryRouter initialEntries={[`/edit-shop/${product.id}`]}>
      <Routes>
        <Route path="/edit-shop/:id" element={<EditShop />} />
        <Route path="/shop" element={<p>Product list</p>} />
      </Routes>
    </MemoryRouter>,
  );
};

const loaded = () => waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue("Glow Serum"));

const field = (label: string) => screen.getByLabelText(label).closest(".ant-form-item") as HTMLElement;

/** The open select's choices: each one's name, and whether it's marked editorial. */
const choices = () =>
  [...document.querySelectorAll<HTMLElement>(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option")].map(
    (el) => ({ name: el.getAttribute("title"), editorial: within(el).queryByText("Editorial") !== null }),
  );

/** Picks a choice of an antd Select, by its name. */
const choose = async (combobox: HTMLElement, name: string) => {
  fireEvent.mouseDown(combobox);
  const option = await waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>(".ant-select-item-option")].find(
      (el) => el.getAttribute("title") === name,
    );
    if (!found) throw new Error(`No choice "${name}"`);
    return found;
  });
  fireEvent.click(option);
};

const save = () => fireEvent.click(screen.getByRole("button", { name: "Update Shop" }));

/** What the save sent. */
const sentForm = () => vi.mocked(axios.put).mock.lastCall?.[1] as FormData;

describe("Edit product: category, tag and button label", () => {
  it("shows the product's category, tag and button label, and marks the editorial tags", async () => {
    renderEdit(saved({ category: "Body & Bath", tag: EDITORS_PICK, button_label: "Book a demo" }));
    await loaded();

    expect(field("Category")).toHaveTextContent("Body & Bath");
    // The chosen tag is marked too.
    expect(within(field("Tag")).getByText("Editor's Pick")).toBeInTheDocument();
    expect(within(field("Tag")).getByText("Editorial")).toBeInTheDocument();
    expect(screen.getByLabelText("Button label")).toHaveValue("Book a demo");
    expect(screen.getByLabelText("Button label")).toHaveAttribute("placeholder", "Shop now");
    expect(
      screen.getByText("The button on the product page and on the product's cards. Empty: “Shop now”."),
    ).toBeInTheDocument();

    // Every tag, in the list's order, after a choice for none; only the editorial ones are marked.
    fireEvent.mouseDown(screen.getByLabelText("Tag"));
    await waitFor(() =>
      expect(choices()).toEqual([
        { name: "No tag", editorial: false },
        { name: "Featured in The Beauty Vault", editorial: true },
        { name: "Editor's Pick", editorial: true },
        { name: "Pro Favorite", editorial: false },
        { name: "New", editorial: false },
        { name: "Best Seller", editorial: false },
      ]),
    );
    expect(axios.get).toHaveBeenCalledWith(`${API}discover/shop/tags`);
  });

  it("offers the eight categories after a choice for none, and saves the choices made", async () => {
    renderEdit(saved({ category: "Body & Bath", tag: EDITORS_PICK, button_label: "Book a demo" }));
    await loaded();

    fireEvent.mouseDown(screen.getByLabelText("Category"));
    await waitFor(() => expect(choices().map((c) => c.name)).toEqual(["No category", ...PRODUCT_CATEGORIES]));
    await choose(screen.getByLabelText("Category"), "Devices & Tools");
    await choose(screen.getByLabelText("Tag"), "No tag");
    fireEvent.change(screen.getByLabelText("Button label"), { target: { value: " Pre-order " } });
    save();

    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    expect(vi.mocked(axios.put).mock.lastCall?.[0]).toBe(`${API}discover/shop/7`);
    expect(sentForm().get("category")).toBe("Devices & Tools");
    expect(sentForm().get("tag_id")).toBe("");
    expect(sentForm().get("button_label")).toBe("Pre-order");
    expect(await screen.findByText("Product list")).toBeInTheDocument();
  });

  it("clears the category and the button label with an empty value, and sends a new tag's id", async () => {
    renderEdit(saved({ category: "Skincare", tag: null, button_label: "Book a demo" }));
    await loaded();

    await choose(screen.getByLabelText("Category"), "No category");
    await choose(screen.getByLabelText("Tag"), "Best Seller");
    fireEvent.change(screen.getByLabelText("Button label"), { target: { value: "" } });
    save();

    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    expect(sentForm().get("category")).toBe("");
    expect(sentForm().get("tag_id")).toBe("5");
    // The button then says "Shop now".
    expect(sentForm().get("button_label")).toBe("");
  });

  it("shows a category saved before the list, and leaves it out of the save so it stays", async () => {
    renderEdit(saved({ category: "Beauty" }));
    await loaded();

    expect(field("Category")).toHaveTextContent("Beauty (not in the list)");
    expect(
      screen.getByText("“Beauty” was saved before the list of eight; it stays as it is until another is picked."),
    ).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByLabelText("Category"));
    await waitFor(() =>
      expect(choices().map((c) => c.name)).toEqual(["No category", "Beauty (not in the list)", ...PRODUCT_CATEGORIES]),
    );
    save();

    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    expect(sentForm().has("category")).toBe(false);
    expect(sentForm().get("tag_id")).toBe("");
  });

  it("keeps the product's tag when the tag list can't be loaded", async () => {
    renderEdit(saved({ tag: EDITORS_PICK }), new Error("Network Error"));
    await loaded();

    expect(await screen.findByText("Couldn't load the product tags")).toBeInTheDocument();
    expect(within(field("Tag")).getByText("Editor's Pick")).toBeInTheDocument();
    save();

    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    expect(sentForm().get("tag_id")).toBe("2");
  });

  it("shows a refusal on the field it names", async () => {
    renderEdit(saved({ tag: EDITORS_PICK }));
    vi.mocked(axios.put).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: { success: false, message: "tag_id is not a tag.", code: "INVALID_PRODUCT", details: { field: "tag_id" } },
      },
    });
    await loaded();
    save();

    // On the field, and in the message.
    await waitFor(() => expect(screen.getAllByText("tag_id is not a tag.")).toHaveLength(2));
    expect(within(field("Tag")).getByText("tag_id is not a tag.")).toBeInTheDocument();
    expect(screen.queryByText("Product list")).not.toBeInTheDocument();
  });
});
