import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import axios from "axios";
import Professionals from "./Professionals";
import type { Professional } from "../../types/user";
import type { SubscriptionSeat } from "../../types/access";

// No network in tests: each test says what the API answers.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), post: vi.fn<Call>(), put: vi.fn<Call>() },
    // utils/apiError reads failures through this.
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const API = "https://api.test/api/v1/";

const professional = (id: number, name: string): Professional => ({
  id,
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
  created_at: "2026-10-01T12:00:00.000Z",
  user_profile: { name },
});

const seat = (fields: Partial<SubscriptionSeat>): SubscriptionSeat => ({
  id: 1,
  user_id: 12,
  source: "stripe",
  status: "active",
  stripe_customer_id: "cus_1",
  stripe_subscription_id: "sub_1",
  amount_cents: 1900,
  currency: "usd",
  current_period_end: "2026-12-08T12:00:00.000Z",
  cancel_at_period_end: false,
  started_at: "2026-10-08T12:00:00.000Z",
  canceled_at: null,
  ended_at: null,
  created_at: "2026-10-08T12:00:00.000Z",
  updated_at: "2026-11-08T12:00:00.000Z",
  ...fields,
});

const PROFESSIONALS = [
  professional(12, "Kate Sibley"),
  professional(13, "Ana Ruiz"),
  professional(14, "Mia Chen"),
  professional(15, "Jo Park"),
];

/** Answers each GET by its path under the API; the subscriptions as given, or a failure. */
const answer = (seats: SubscriptionSeat[] | Error) =>
  vi.mocked(axios.get).mockImplementation(async (url) => {
    const path = String(url).replace(API, "");
    if (path === "admin/users/list/7") return { status: 200, data: { data: { count: PROFESSIONALS.length, rows: PROFESSIONALS } } };
    if (path === "access/admin/subscriptions") {
      if (seats instanceof Error) throw seats;
      return { status: 200, data: { data: seats } };
    }
    throw new Error(`No answer for GET ${path}`);
  });

const renderList = () =>
  render(
    <MemoryRouter>
      <Professionals />
    </MemoryRouter>,
  );

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

describe("Professionals: their Access Pro", () => {
  it("shows who has Access Pro and how, and who has none", async () => {
    answer([
      seat({ user_id: 12 }),
      seat({ id: 2, user_id: 13, source: "comp", stripe_customer_id: null, stripe_subscription_id: null, amount_cents: null }),
      seat({ id: 3, user_id: 14, status: "canceled", canceled_at: "2026-11-01T12:00:00.000Z" }),
    ]);
    renderList();

    expect(await screen.findByRole("columnheader", { name: "Access Pro" })).toBeInTheDocument();
    await screen.findByText("Kate Sibley");
    expect(await within(rowOf("Kate Sibley")).findByText("Active")).toBeInTheDocument();
    expect(within(rowOf("Kate Sibley")).getByText("Stripe")).toBeInTheDocument();
    expect(within(rowOf("Ana Ruiz")).getByText("Active")).toBeInTheDocument();
    expect(within(rowOf("Ana Ruiz")).getByText("Complimentary")).toBeInTheDocument();
    expect(within(rowOf("Mia Chen")).getByText("Canceled")).toBeInTheDocument();
    expect(within(rowOf("Jo Park")).getByText("None")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(`${API}access/admin/subscriptions`, { params: {} });
  });

  it("still lists the professionals when the subscriptions can't load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    answer(new Error("Network Error"));
    renderList();

    expect(await screen.findByText("Kate Sibley")).toBeInTheDocument();
    expect(await within(rowOf("Kate Sibley")).findByText("—")).toBeInTheDocument();
    expect(within(rowOf("Jo Park")).getByText("—")).toBeInTheDocument();
  });
});
