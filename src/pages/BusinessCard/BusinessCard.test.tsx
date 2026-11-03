import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import axios from "axios";
import BusinessCard from "./BusinessCard";
import type { BusinessCard as Card } from "../../types/businessCard";

// No network in tests: the card list answers the cards below.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), post: vi.fn<Call>(), put: vi.fn<Call>() },
    // utils/apiError reads failures through this.
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const card = (fields: Partial<Card> & Pick<Card, "id" | "name">): Card => ({
  email: `card${fields.id}@example.com`,
  status: "accepted",
  created_at: "2026-10-28T17:00:00.000Z",
  ...fields,
});

const CARDS = [
  card({ id: 1, name: "Jane Smith", professional_type: "individual" }),
  card({ id: 2, name: "Lumen Labs", professional_type: "brand", status: "pending" }),
  // Saved before cards had a type: a professional's.
  card({ id: 3, name: "Kate Sue" }),
];

const renderList = async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { data: CARDS } });
  render(
    <MemoryRouter>
      <BusinessCard />
    </MemoryRouter>,
  );
  await screen.findByText("Lumen Labs");
};

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

/** Picks an option of an antd Select. */
const choose = async (combobox: HTMLElement, label: string) => {
  fireEvent.mouseDown(combobox);
  const option = await waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>(".ant-select-item-option")].find(
      (el) => el.textContent === label,
    );
    if (!found) throw new Error(`No option "${label}"`);
    return found;
  });
  fireEvent.click(option);
};

describe("Card list: professional or brand", () => {
  it("shows each card's type, and a card without one as a professional's", async () => {
    await renderList();

    expect(within(rowOf("Jane Smith")).getByText("Professional")).toBeInTheDocument();
    expect(within(rowOf("Lumen Labs")).getByText("Brand")).toBeInTheDocument();
    expect(within(rowOf("Kate Sue")).getByText("Professional")).toBeInTheDocument();
  });

  it("filters the cards by type", async () => {
    await renderList();

    await choose(screen.getByRole("combobox", { name: "Type" }), "Brand");
    expect(rowOf("Lumen Labs")).toBeInTheDocument();
    expect(screen.queryByText("Jane Smith")).not.toBeInTheDocument();
    expect(screen.queryByText("Kate Sue")).not.toBeInTheDocument();

    await choose(screen.getByRole("combobox", { name: "Type" }), "Professional");
    expect(rowOf("Jane Smith")).toBeInTheDocument();
    expect(rowOf("Kate Sue")).toBeInTheDocument();
    expect(screen.queryByText("Lumen Labs")).not.toBeInTheDocument();
  });
});
