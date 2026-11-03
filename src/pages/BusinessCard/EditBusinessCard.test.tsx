import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import EditBusinessCard from "./EditBusinessCard";
import type { BusinessCard } from "../../types/businessCard";

// No network in tests: the card below, and empty state and specialty lists.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), put: vi.fn<Call>() },
    // utils/apiError reads failures through this.
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

// The bio editor (Tiptap) has its own tests; a text box stands in for it here.
vi.mock("../../components/RichTextEditor", () => ({
  default: ({ value, onChange }: { value?: string; onChange: (html: string) => void }) => (
    <textarea aria-label="Bio editor" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const API = "https://api.test/api/v1/";

const saved = (fields: Partial<BusinessCard>): BusinessCard => ({
  id: 5,
  name: "Mia Chen",
  business_name: "Lumen Labs",
  email: "mia@lumen.example",
  phone: "7025550142",
  is_phone_visible: true,
  bio: "<p>Clean skincare, made in Las Vegas.</p>",
  status: "accepted",
  created_at: "2026-10-28T17:00:00.000Z",
  ...fields,
});

const renderEdit = (card: BusinessCard) => {
  vi.mocked(axios.get).mockImplementation(async (url) =>
    String(url) === `${API}businessCard/getBusinessCardById/${card.id}`
      ? { data: { data: card } }
      : { data: { data: [], rows: [] } },
  );
  vi.mocked(axios.put).mockResolvedValue({ data: { data: card } });
  render(
    <MemoryRouter initialEntries={[`/editBusinessCard/${card.id}`]}>
      <Routes>
        <Route path="/editBusinessCard/:id" element={<EditBusinessCard />} />
        <Route path="/digital-card" element={<p>Card list</p>} />
      </Routes>
    </MemoryRouter>,
  );
};

/** What the save sent. */
const sentForm = () => vi.mocked(axios.put).mock.calls[0][1] as FormData;

const typeField = () => screen.getByLabelText("Type").closest(".ant-form-item") as HTMLElement;

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

// A pattern: after a refused save the button's loading icon stays in jsdom (its leave animation never ends).
const save = () => fireEvent.click(screen.getByRole("button", { name: /Update Business Card/ }));

describe("Edit card: professional or brand", () => {
  it("loads a brand's card as a brand and saves it with no tagline and no location", async () => {
    renderEdit(saved({ professional_type: "brand", professional_title: null, locations: [] }));

    await waitFor(() => expect(screen.getByLabelText("Business Name")).toHaveValue("Lumen Labs"));
    expect(typeField()).toHaveTextContent("Brand");
    expect(screen.getByLabelText("Contact Name")).toHaveValue("Mia Chen");
    expect(screen.getByLabelText("Tagline (optional)")).toHaveValue("");
    save();

    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    expect(vi.mocked(axios.put).mock.calls[0][0]).toBe(`${API}businessCard/updateBusinessCard/5`);
    expect(sentForm().get("professional_type")).toBe("brand");
    expect(sentForm().get("professional_title")).toBe("");
    expect(sentForm().get("locations")).toBe("[]");
    expect(await screen.findByText("Card list")).toBeInTheDocument();
  });

  it("wants a professional's title, until the card is made a brand's", async () => {
    // Saved before cards had a type: a professional's.
    renderEdit(saved({ name: "Jane Smith", business_name: "Glow Studio", professional_title: null }));

    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Jane Smith"));
    expect(typeField()).toHaveTextContent("Professional");
    save();
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(axios.put).not.toHaveBeenCalled();

    await choose(screen.getByLabelText("Type"), "Brand");
    // The form now asks for a brand's fields.
    expect(await screen.findByLabelText("Tagline (optional)")).toBeInTheDocument();
    save();
    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    expect(sentForm().get("professional_type")).toBe("brand");
  });
});
