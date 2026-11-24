import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import App from "./App";
import { SIDEBAR_SCREENS } from "./components/sidebarMenu";
import { clearSession, setToken } from "./utils/session";

// No network in tests: every API call resolves with an empty list.
vi.mock("axios", () => {
  const ok = () => Promise.resolve({ status: 200, data: { data: [], rows: [] } });
  return {
    default: { get: vi.fn<typeof ok>(ok), post: vi.fn<typeof ok>(ok), put: vi.fn<typeof ok>(ok), delete: vi.fn<typeof ok>(ok), patch: vi.fn<typeof ok>(ok) },
    // utils/apiError reads failures through this.
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const renderAt = (path: string) => {
  window.history.pushState({}, "", path);
  return render(<App />);
};

const sidebar = (container: HTMLElement) => container.querySelector(".ant-layout-sider") as HTMLElement;
/** A sidebar entry or group title, by its label. */
const sidebarItem = (container: HTMLElement, label: string) =>
  within(sidebar(container)).getByText(label).closest("li") as HTMLElement;

describe("App routing", () => {
  it("shows the login page", () => {
    renderAt("/login");
    expect(screen.getByRole("button", { name: "SIGN IN" })).toBeInTheDocument();
  });

  it("shows the layout and the requested page when signed in", async () => {
    localStorage.setItem("adminToken", "test-token");
    const { container } = renderAt("/inquiries/newsletter");
    expect(await screen.findByText(/People who signed up through the website's newsletter forms/)).toBeInTheDocument();
    expect(container.querySelector(".ant-layout-sider")).toBeInTheDocument();
    expect(screen.getByText("Admins")).toBeInTheDocument();
  });

  it("shows the login form inside the layout route when signed out", () => {
    renderAt("/professionals");
    expect(screen.getByRole("button", { name: "SIGN IN" })).toBeInTheDocument();
  });

  it("doesn't save a session when login returns no token", async () => {
    renderAt("/login");
    fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "SIGN IN" }));

    expect(await screen.findByText(/the server sent no session/)).toBeInTheDocument();
    expect(localStorage.getItem("adminToken")).toBeNull();
  });

  it("swaps the layout for the login form when the session ends", async () => {
    localStorage.setItem("adminToken", "test-token");
    renderAt("/inquiries/newsletter");
    expect(await screen.findByText(/People who signed up through the website's newsletter forms/)).toBeInTheDocument();

    act(() => clearSession());
    expect(screen.getByRole("button", { name: "SIGN IN" })).toBeInTheDocument();
    expect(screen.queryByText(/People who signed up through the website's newsletter forms/)).not.toBeInTheDocument();
  });

  // The token itself is attached by the shared client (utils/session.test.ts).
  it("loads the profile and pending counts only once signed in", async () => {
    const get = vi.mocked(axios.get);
    const requested = (path: string) => get.mock.calls.some(([url]) => url.endsWith(path));
    const paths = ["admin/profile", "form/getPendingFormCount", "directory/applications", "directory/claims"];

    renderAt("/professionals");
    expect(screen.getByRole("button", { name: "SIGN IN" })).toBeInTheDocument();
    expect(paths.filter(requested)).toEqual([]);

    act(() => setToken("test-token"));
    await screen.findByText("Admins");
    expect(paths.filter(requested)).toEqual(paths);
  });

  it("opens Listing Claims from the sidebar, with the claims to verify as a badge", async () => {
    localStorage.setItem("adminToken", "test-token");
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      status: 200,
      data: String(url).endsWith("directory/claims") ? { data: { count: 2, rows: [] } } : { data: [], rows: [] },
    }));
    const { container } = renderAt("/directory/claims");

    expect(await screen.findByRole("heading", { name: "Listing Claims" })).toBeInTheDocument();
    const entry = sidebarItem(container, "Listing Claims");
    expect(entry).toHaveClass("ant-menu-item-selected");
    expect(await within(entry).findByText("2")).toBeInTheDocument();
    // Its group is open, so the count shows on the entry only.
    expect(within(sidebarItem(container, "Directory").querySelector(".ant-menu-submenu-title")!).queryByText("2")).toBeNull();
  });

  it("shows a closed group's work waiting on the group", async () => {
    localStorage.setItem("adminToken", "test-token");
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      status: 200,
      data: String(url).endsWith("directory/claims") ? { data: { count: 2, rows: [] } } : { data: [], rows: [] },
    }));
    const { container } = renderAt("/");

    expect(await within(sidebarItem(container, "Directory")).findByText("2")).toBeInTheDocument();
  });

  it("opens Product Tags from the sidebar, in Shop right after Products", async () => {
    localStorage.setItem("adminToken", "test-token");
    const { container } = renderAt("/shop/tags");

    expect(await screen.findByRole("heading", { name: "Product Tags" })).toBeInTheDocument();
    const entry = sidebarItem(container, "Product Tags");
    expect(entry).toHaveClass("ant-menu-item-selected");
    expect(entry.previousElementSibling).toHaveTextContent("Products");
    expect(entry.previousElementSibling).not.toHaveClass("ant-menu-item-selected");
    expect(sidebarItem(container, "Shop")).toHaveClass("ant-menu-submenu-open");
  });

  it("lists Subscriptions with the professionals, and Topics on their own, outside the Journal", async () => {
    localStorage.setItem("adminToken", "test-token");
    const { container } = renderAt("/professionals/subscriptions");

    expect(await screen.findByRole("heading", { name: "Subscriptions" })).toBeInTheDocument();
    const professionals = sidebarItem(container, "Professionals");
    expect(within(professionals).getByText("All Professionals")).toBeInTheDocument();
    expect(within(professionals).getByText("Subscriptions").closest("li")).toHaveClass("ant-menu-item-selected");

    // Topics is an entry of its own, at the top level of the sidebar.
    const topics = sidebarItem(container, "Topics");
    expect(topics).toHaveClass("ant-menu-item");
    expect(topics.parentElement).toBe(sidebarItem(container, "Journal").parentElement);
  });

  it("keeps one group open at a time", async () => {
    localStorage.setItem("adminToken", "test-token");
    const { container } = renderAt("/journal/articles");

    await waitFor(() => expect(sidebarItem(container, "Journal")).toHaveClass("ant-menu-submenu-open"));
    fireEvent.click(within(sidebarItem(container, "Shop")).getByText("Shop"));
    await waitFor(() => expect(sidebarItem(container, "Shop")).toHaveClass("ant-menu-submenu-open"));
    expect(sidebarItem(container, "Journal")).not.toHaveClass("ant-menu-submenu-open");
  });

  it("selects a list's entry on its add, edit and detail pages", async () => {
    localStorage.setItem("adminToken", "test-token");
    const { container } = renderAt("/professionals/pages/new");

    expect(await screen.findByRole("heading", { name: "New brand page" })).toBeInTheDocument();
    expect(sidebarItem(container, "Profile Pages")).toHaveClass("ant-menu-item-selected");
    expect(sidebarItem(container, "All Professionals")).not.toHaveClass("ant-menu-item-selected");
  });

  // Every entry has a screen behind it, and selects itself there.
  it.each(SIDEBAR_SCREENS.map(({ label, path }) => [label, path]))("opens %s at %s", async (label, path) => {
    localStorage.setItem("adminToken", "test-token");
    const { container } = renderAt(path);

    expect(sidebarItem(container, label)).toHaveClass("ant-menu-item-selected");
    expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
  });

  // Old addresses redirect: bookmarks, and the order email's link to one order (/access-orders/:id).
  it.each([
    ["/access-orders/7", "/access/orders/7"],
    ["/digital-card?status=draft", "/access/cards?status=draft"],
    ["/viewProfessionals/12", "/professionals/12"],
    ["/access-subscriptions", "/professionals/subscriptions"],
    ["/pages/new", "/professionals/pages/new"],
    ["/edit-journal/31", "/journal/articles/31"],
    ["/journal-topics/edit/4", "/topics/4/edit"],
    ["/shop", "/shop/products"],
    ["/directory-applications/edit/5", "/directory/applications/5/edit"],
    ["/loginLogs", "/professionals/login-activity"],
    ["/viewAdmin", "/account"],
  ])("moves %s to %s", async (from, to) => {
    localStorage.setItem("adminToken", "test-token");
    renderAt(from);

    await waitFor(() => expect(`${window.location.pathname}${window.location.search}`).toBe(to));
    expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
  });

  it("says so for an address that is no screen, such as a removed one", async () => {
    localStorage.setItem("adminToken", "test-token");
    renderAt("/blogs");
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    expect(screen.queryByText(/blog/i)).not.toBeInTheDocument();
  });

  it("keeps the header's menu to the admin's own account; Login Activity is in the sidebar", async () => {
    localStorage.setItem("adminToken", "test-token");
    const { container } = renderAt("/");

    fireEvent.click(container.querySelector(".ant-layout-header [role=button]")!);
    expect(await screen.findByText("View Profile")).toBeInTheDocument();
    expect(screen.getByText("Change Password")).toBeInTheDocument();
    expect(screen.queryByText("User Login Activity")).not.toBeInTheDocument();
  });

  // The website comes first: the mobile app's screens are gone until the app is rebuilt.
  it.each([
    ["/users", /USER MANAGEMENT/i],
    ["/posts-list", /posts/i],
    ["/clips-list", /clips/i],
    ["/appointments", /appointment/i],
    ["/product-list", /product/i],
    ["/orders", /orders/i],
    ["/reward-rules", /reward/i],
    ["/banner", /banner/i],
  ])("has no app screen at %s", (path, heading) => {
    localStorage.setItem("adminToken", "test-token");
    renderAt(path);
    expect(screen.queryByRole("heading", { name: heading })).not.toBeInTheDocument();
  });

  it("shows no app screens in the sidebar", async () => {
    localStorage.setItem("adminToken", "test-token");
    renderAt("/");
    await screen.findByText("Admins");
    for (const label of ["Users", "Posts", "Clips", "Appointments", "Referrals", "Glam Rewards Rules", "Ecommerce", "Banner"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});
