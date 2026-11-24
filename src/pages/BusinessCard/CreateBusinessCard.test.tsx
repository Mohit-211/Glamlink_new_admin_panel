import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import CreateBusinessCard from "./CreateBusinessCard";

// No network in tests: empty state and specialty lists, and the new card saved.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), post: vi.fn<Call>() },
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

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

// A pattern: after a refused save the button's loading icon stays in jsdom (its leave animation never ends).
const create = () => fireEvent.click(screen.getByRole("button", { name: /Create Access Card/ }));

describe("Create card: professional or brand", () => {
  it("starts as a professional's card, which needs a title, and makes a brand's without one", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { data: [], rows: [] } });
    vi.mocked(axios.post).mockResolvedValue({ data: { data: { id: 9 } } });
    render(
      <MemoryRouter initialEntries={["/access/cards/new"]}>
        <Routes>
          <Route path="/access/cards/new" element={<CreateBusinessCard />} />
          <Route path="/access/cards" element={<p>Card list</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Type").closest(".ant-form-item")).toHaveTextContent("Professional");
    type("Full Name", "Mia Chen");
    type("Business Name", "Lumen Labs");
    type("Bio editor", "<p>Clean skincare, made in Las Vegas.</p>");
    type("Email", "mia@lumen.example");
    type("Phone", "7025550142");
    create();
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();

    await choose(screen.getByLabelText("Type"), "Brand");
    expect(await screen.findByLabelText("Tagline (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Contact Name")).toHaveValue("Mia Chen");
    create();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    const [url, body] = vi.mocked(axios.post).mock.calls[0];
    expect(url).toBe(`${API}businessCard/createBusinessCardByAdmin`);
    expect((body as FormData).get("professional_type")).toBe("brand");
    expect((body as FormData).get("professional_title")).toBeNull();
    expect((body as FormData).get("name")).toBe("Mia Chen");
    expect(await screen.findByText("Card list")).toBeInTheDocument();
  });
});
