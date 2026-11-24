import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AddShop from "./AddShop";
import type { ProductTag } from "../../../../types/productTag";

// No network in tests: the tag list, no topics, and the new product's id.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), post: vi.fn<Call>() },
    // utils/apiError reads failures through this.
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const API = "https://api.test/api/v1/";

const TAGS: ProductTag[] = [
  { id: 1, name: "Featured in The Beauty Vault", is_editorial: true, sort_order: 1 },
  { id: 4, name: "New", is_editorial: false, sort_order: 4 },
];

const renderAdd = () => {
  vi.mocked(axios.get).mockImplementation(async (url) =>
    String(url) === `${API}discover/shop/tags` ? { data: { success: true, data: TAGS } } : { data: { data: [], rows: [] } },
  );
  vi.mocked(axios.post).mockResolvedValue({ data: { data: { id: 41 } } });
  render(
    <MemoryRouter initialEntries={["/shop/products/new"]}>
      <Routes>
        <Route path="/shop/products/new" element={<AddShop />} />
        <Route path="/shop/products" element={<p>Product list</p>} />
      </Routes>
    </MemoryRouter>,
  );
};

const field = (label: string) => screen.getByLabelText(label).closest(".ant-form-item") as HTMLElement;

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

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("Add product: category, tag and button label", () => {
  it("starts with no category, no tag and the button's default, and sends the ones chosen", async () => {
    renderAdd();

    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(`${API}discover/shop/tags`));
    expect(field("Category")).toHaveTextContent("No category");
    expect(field("Tag")).toHaveTextContent("No tag");
    expect(screen.getByLabelText("Button label")).toHaveValue("");
    expect(screen.getByLabelText("Button label")).toHaveAttribute("placeholder", "Shop now");

    type("Title", "Glow Serum");
    type("Short Description", "A light vitamin C serum.");
    type("Link", "https://shop.example/glow-serum");
    await choose(screen.getByLabelText("Category"), "Skincare");
    // An admin can set an editorial tag.
    await choose(screen.getByLabelText("Tag"), "Featured in The Beauty Vault");
    type("Button label", "Pre-order");
    fireEvent.click(screen.getByRole("button", { name: "Publish Product" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    const [url, sent] = vi.mocked(axios.post).mock.calls[0] as [string, FormData];
    expect(url).toBe(`${API}discover/shop`);
    expect(sent.get("category")).toBe("Skincare");
    expect(sent.get("tag_id")).toBe("1");
    expect(sent.get("button_label")).toBe("Pre-order");
    expect(await screen.findByText("Product list")).toBeInTheDocument();
  });
});
