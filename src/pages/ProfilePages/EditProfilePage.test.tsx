import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import axios from "axios";
import EditProfilePage from "./EditProfilePage";
import type { PageSettings, PageView } from "../../types/profile";

// No network in tests: each test says what the page and the save answer.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), post: vi.fn<Call>(), put: vi.fn<Call>() },
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const PAGE = "https://api.test/api/v1/profiles/admin/812";

// A brand with a live card and nothing set on its page: everything shown comes from the card.
const view = (page: Partial<PageSettings> = {}, fields: Partial<PageView> = {}): PageView => ({
  user_id: 812,
  slug: "revance",
  visible: true,
  hidden_because: null,
  page: {
    slug: null,
    is_listed: true,
    is_featured: false,
    featured_order: 0,
    created_by_admin: false,
    tagline: null,
    about: null,
    image: null,
    cover_image: null,
    website: null,
    social: null,
    ...page,
  },
  public: {
    id: 812,
    slug: "revance",
    type: "brand",
    name: "Revance",
    image: "https://api.test/images/card.jpg",
    tagline: "The card's title",
    city: null,
    state: null,
    specialty: null,
    is_featured: false,
    cover_image: null,
    about: "<p>The card's bio</p>",
    website: "https://revance.com",
    social: [{ title: "Instagram", url: "https://www.instagram.com/revance" }],
    location: null,
    specialties: [],
    email: null,
    phone: null,
    booking_link: null,
    access_card: { slug: "revance", url: "https://glamlink.net/access/revance" },
    listing: null,
    topics: [],
  },
  ...fields,
});

const refusal = (status: number, code: string, message: string, details?: object) => ({
  isAxiosError: true,
  response: { status, data: { success: false, status, message, code, details } },
});

const renderPage = (state?: object) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/pages/812", state }]}>
      <Routes>
        <Route path="/pages/:userId" element={<EditProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );

const save = () => fireEvent.click(screen.getByRole("button", { name: "Save page" }));

describe("Professional and brand pages: one page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the form's fields only, leaving the card's handle and links alone", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { data: view() } });
    vi.mocked(axios.put).mockResolvedValue({ data: { data: view({ tagline: "Skin care, made simple" }) } });
    renderPage({ claimed: true });

    const tagline = await screen.findByRole("textbox", { name: "Tagline" });
    // An empty field shows what the page falls back to.
    expect(tagline).toHaveAttribute("placeholder", "The card's title");
    expect(screen.getByRole("textbox", { name: "Address" })).toHaveValue("revance");

    fireEvent.change(tagline, { target: { value: "Skin care, made simple" } });
    save();

    expect(await screen.findByText("Page saved")).toBeInTheDocument();
    expect(axios.put).toHaveBeenCalledWith(PAGE, {
      is_listed: true,
      is_featured: false,
      featured_order: 0,
      tagline: "Skin care, made simple",
      intro: null,
      about: null,
      website: null,
      social: null,
      category: null,
      shipping: null,
      image: null,
      cover_image: null,
      about_image: null,
    });
  });

  it("sends a new address, and shows the API's refusal on that field", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { data: view() } });
    vi.mocked(axios.put).mockRejectedValue(
      refusal(400, "INVALID_PAGE", "This slug is taken.", { field: "slug" }),
    );
    renderPage({ claimed: true });

    fireEvent.change(await screen.findByRole("textbox", { name: "Address" }), { target: { value: "Revance Skin" } });
    save();

    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    expect(vi.mocked(axios.put).mock.lastCall?.[1]).toMatchObject({ slug: "revance-skin" });
    // On the field, and in the message (the field may be out of view).
    await waitFor(() => expect(screen.getAllByText("This slug is taken.")).toHaveLength(2));
  });

  it("says why a page is hidden", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        data: view(
          { is_listed: false },
          { visible: false, hidden_because: "no_live_card", public: { ...view().public, access_card: null } },
        ),
      },
    });
    renderPage({ claimed: true });

    expect(await screen.findByText("Hidden from the website")).toBeInTheDocument();
    expect(screen.getByText(/It is unlisted/)).toBeInTheDocument();
    expect(screen.getByText(/It has no live Access card/)).toBeInTheDocument();
  });

  it("offers the claim email when it isn't known whether the account can sign in", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { data: view() } });
    vi.mocked(axios.post).mockRejectedValue(
      refusal(409, "ALREADY_CLAIMED", "This account already has a password: it can sign in."),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Send claim email/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Send" }));

    expect(await screen.findByText(/This account can already sign in/)).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith(`${PAGE}/invite`);
    await waitFor(() => expect(screen.queryByRole("button", { name: /Send claim email/ })).not.toBeInTheDocument());
  });

  it("doesn't offer the claim email to an account that can sign in", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { data: view() } });
    renderPage({ claimed: true });

    await screen.findByRole("textbox", { name: "Tagline" });
    expect(screen.queryByRole("button", { name: /Send claim email/ })).not.toBeInTheDocument();
  });
});

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

const optionLabels = () =>
  [...document.querySelectorAll<HTMLElement>(".ant-select-item-option")].map((el) => el.textContent);

/** Answers each GET by its path under the API. */
const answerGets = (routes: Record<string, unknown>) => {
  vi.mocked(axios.get).mockImplementation((url) => {
    const path = String(url).replace("https://api.test/api/v1/", "");
    return path in routes
      ? Promise.resolve({ data: { success: true, data: routes[path] } })
      : Promise.reject(new Error(`No answer for GET ${path}`));
  });
};

describe("Professional and brand pages: the owner's design (Nov 3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the intro, a brand's category and the shipping, and shows what fills the gaps", async () => {
    const shown = {
      ...view().public,
      intro: "The card's bio, as plain text",
      about_image: "https://api.test/images/first-photo.jpg",
    };
    answerGets({ "profiles/admin/812": view({}, { public: shown }) });
    vi.mocked(axios.put).mockResolvedValue({
      data: { data: view({ intro: "Clean skin care", category: "skincare", shipping: "nationwide" }, { public: shown }) },
    });
    renderPage({ claimed: true });

    const intro = await screen.findByRole("textbox", { name: "Intro" });
    // An empty intro shows the card's bio; an empty About image, the page's first photo.
    expect(intro).toHaveAttribute("placeholder", "The card's bio, as plain text");
    expect(intro).toHaveAttribute("maxlength", "300");
    expect(screen.getByText("0 / 300")).toBeInTheDocument();
    expect(screen.getAllByText("Showing now").length).toBeGreaterThan(0);
    expect(document.querySelector('img[src="https://api.test/images/first-photo.jpg"]')).not.toBeNull();

    fireEvent.change(intro, { target: { value: "Clean skin care" } });
    expect(screen.getByText("15 / 300")).toBeInTheDocument();
    // A brand picks from the eight brand categories, shown as "<label> Brand".
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Category" }));
    await waitFor(() => expect(optionLabels()).toContain("Wellness & Supplements Brand"));
    expect(optionLabels().filter((label) => label?.endsWith(" Brand"))).toHaveLength(8);
    await choose(screen.getByRole("combobox", { name: "Category" }), "Skincare Brand");
    await choose(screen.getByRole("combobox", { name: "Shipping" }), "Ships nationwide");
    save();

    expect(await screen.findByText("Page saved")).toBeInTheDocument();
    expect(vi.mocked(axios.put).mock.lastCall?.[1]).toMatchObject({
      intro: "Clean skin care",
      category: "skincare",
      shipping: "nationwide",
      about_image: null,
    });
    // A brand's categories need no specialties.
    expect(axios.get).not.toHaveBeenCalledWith(expect.stringContaining("profession"), expect.anything());
  });

  it("offers a professional the specialties, keeps a saved one off the list, and puts a refusal under its field", async () => {
    const pro = view({ category: "Lash Artistry", shipping: "local" }, { public: { ...view().public, type: "individual" } });
    answerGets({
      "profiles/admin/812": pro,
      profession: { count: 2, rows: [{ id: 1, title: "Hair Stylist" }, { id: 2, title: "Esthetician" }] },
    });
    vi.mocked(axios.put).mockRejectedValue(
      refusal(400, "INVALID_PAGE", "category is at most 60 characters.", { field: "category" }),
    );
    renderPage({ claimed: true });

    await screen.findByRole("textbox", { name: "Intro" });
    expect(axios.get).toHaveBeenCalledWith("https://api.test/api/v1/profession", expect.anything());
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Category" }));
    await waitFor(() => expect(optionLabels()).toEqual(["Not set", "Lash Artistry", "Hair Stylist", "Esthetician"]));
    await choose(screen.getByRole("combobox", { name: "Shipping" }), "Ships internationally");
    save();

    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    expect(vi.mocked(axios.put).mock.lastCall?.[1]).toMatchObject({ category: "Lash Artistry", shipping: "international" });
    // On the field, and in the message.
    await waitFor(() => expect(screen.getAllByText("category is at most 60 characters.")).toHaveLength(2));
  });
});

/** Shows the address the screen is at, to check what `?tab=` says. */
const Address = () => {
  const { pathname, search } = useLocation();
  return <div data-testid="address">{`${pathname}${search}`}</div>;
};

describe("Professional and brand pages: the screen's tabs", () => {
  beforeEach(() => vi.clearAllMocks());

  const renderAt = (entry: string) =>
    render(
      <MemoryRouter initialEntries={[{ pathname: "/pages/812", search: entry, state: { claimed: true, from: "/pages?type=brand" } }]}>
        <Routes>
          <Route path="/pages/:userId" element={<EditProfilePage />} />
        </Routes>
        <Address />
      </MemoryRouter>,
    );

  it("opens the tab ?tab= names, and changes the address with the tab", async () => {
    answerGets({
      "profiles/admin/812": view(),
      "profiles/admin/812/media": { count: 0, rows: [] },
      "profiles/revance/articles": { count: 0, rows: [] },
      "profiles/revance/videos": { count: 0, rows: [] },
    });
    renderAt("?tab=tagged");

    expect(await screen.findByText("In the Glamlink Journal")).toBeInTheDocument();
    // The status block and the analytics link stay above the tabs.
    expect(screen.getByText("Shown on the website")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Analytics/ })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Tagline" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Media & Images" }));
    expect(await screen.findByText(/No media of its own yet/)).toBeInTheDocument();
    expect(screen.getByTestId("address")).toHaveTextContent("/pages/812?tab=media");
    // "Back" still goes to the list the screen was opened from.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("/pages?type=brand"));
  });

  it("opens the Page tab for an address it doesn't know", async () => {
    answerGets({ "profiles/admin/812": view() });
    renderAt("?tab=nonsense");

    expect(await screen.findByRole("textbox", { name: "Tagline" })).toBeInTheDocument();
    expect(within(screen.getByRole("tablist")).getByRole("tab", { name: "Page", selected: true })).toBeInTheDocument();
  });
});
