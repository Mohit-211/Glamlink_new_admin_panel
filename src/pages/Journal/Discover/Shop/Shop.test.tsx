import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import axios from "axios";
import Shop from "./Shop";
import type { Shop as Product } from "../../../../types/journal";

// No network in tests: the products below.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>() },
    // utils/apiError reads failures through this.
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const product = (id: number, fields: Partial<Product>): Product => ({
  id,
  title: `Product ${id}`,
  short_description: "A product.",
  price: "20.00",
  link: "https://shop.example/product",
  status: "published",
  ...fields,
});

const rowOf = (title: string) => screen.getByText(title).closest("tr") as HTMLElement;

describe("Shop products list", () => {
  it("shows each product's tag, marking editorial ones, and its category", async () => {
    const rows = [
      product(1, { title: "Glow Serum", tag: { id: 2, name: "Editor's Pick", is_editorial: true }, category: "Skincare" }),
      product(2, { title: "Curl Cream", tag: { id: 4, name: "New", is_editorial: false }, category: null }),
      product(3, { title: "Nail Kit", tag: null, category: "Nails" }),
    ];
    vi.mocked(axios.get).mockResolvedValue({ data: { data: { count: rows.length, rows } } });
    render(
      <MemoryRouter>
        <Shop />
      </MemoryRouter>,
    );

    await screen.findByText("Glow Serum");
    expect(axios.get).toHaveBeenCalledWith("https://api.test/api/v1/discover/shop/admin");
    expect(screen.getByRole("columnheader", { name: "Tag" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Category" })).toBeInTheDocument();

    const serum = rowOf("Glow Serum");
    expect(within(serum).getByText("Editor's Pick")).toBeInTheDocument();
    expect(within(serum).getByText("Editorial")).toHaveClass("ant-tag-magenta");
    expect(within(serum).getByText("Skincare")).toBeInTheDocument();

    const cream = rowOf("Curl Cream");
    expect(within(cream).getByText("New")).toBeInTheDocument();
    expect(within(cream).queryByText("Editorial")).not.toBeInTheDocument();

    const kit = rowOf("Nail Kit");
    expect(within(kit).getByText("Nails")).toBeInTheDocument();
    expect(within(kit).queryByText("Editorial")).not.toBeInTheDocument();
  });
});
