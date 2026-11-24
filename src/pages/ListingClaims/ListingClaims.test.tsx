import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import axios from "axios";
import ListingClaims from "./ListingClaims";
import { onRecountBadges } from "../../utils/badges";
import type { ListingClaim } from "../../types/listingClaim";

// No network in tests: each test says what the claims list (and the review) answers.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), put: vi.fn<Call>() },
    // utils/apiError reads failures through this.
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const CLAIMS_URL = "https://api.test/api/v1/directory/claims";

const claim = (fields: Partial<ListingClaim>): ListingClaim => ({
  business_card_id: 12,
  name: "Jane Smith",
  business_name: "Glow Skin Studio",
  email: "jane@glow.example",
  professional_type: "individual",
  status: "accepted",
  user_id: 41,
  place_id: "ChIJglow0123456789",
  verified_at: null,
  created_at: "2026-10-30T18:00:00.000Z",
  maps_url: "https://www.google.com/maps/place/?q=place_id:ChIJglow0123456789",
  ...fields,
});

// Waits to be verified.
const JANE = claim({});
// A brand's verified claim, on a card that is still a draft.
const LUMEN = claim({
  business_card_id: 13,
  name: "Mia Chen",
  business_name: "Lumen Labs",
  email: "mia@lumen.example",
  professional_type: "brand",
  status: "draft",
  place_id: "ChIJlumen987654321",
  maps_url: "https://www.google.com/maps/place/?q=place_id:ChIJlumen987654321",
  verified_at: "2026-10-31T17:30:00.000Z",
});

const answer = (rows: ListingClaim[]) =>
  vi.mocked(axios.get).mockResolvedValue({ data: { data: { count: rows.length, rows } } });

const listCalls = () => vi.mocked(axios.get).mock.calls.filter(([url]) => url === CLAIMS_URL);

const renderClaims = (path = "/directory/claims") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ListingClaims />
    </MemoryRouter>,
  );

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

/** The confirmation a row's Verify or Reject opens. */
const dialogTitled = async (title: string) => (await screen.findByText(title)).closest<HTMLElement>('[role="dialog"]')!;

describe("Listing claims", () => {
  it("lists the claims to verify first, with the card, its type and status, and the Google listing", async () => {
    answer([JANE]);
    renderClaims();

    expect(await screen.findByText("Jane Smith")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(CLAIMS_URL, { params: { status: "pending", page: 1, limit: 50 } });
    const row = rowOf("Jane Smith");
    expect(within(row).getByRole("link", { name: "Jane Smith" })).toHaveAttribute("href", "/access/cards/12");
    expect(within(row).getByText("Glow Skin Studio")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "jane@glow.example" })).toHaveAttribute("href", "mailto:jane@glow.example");
    expect(within(row).getByText("Professional")).toBeInTheDocument();
    expect(within(row).getByText("Accepted")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /Open on Google Maps/ })).toHaveAttribute("href", JANE.maps_url);
    expect(within(row).getByText("Oct 30, 2026")).toBeInTheDocument();
    expect(within(row).getByText("To verify")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: /Verify/ })).toBeInTheDocument();
    expect(screen.getByText("1 claim")).toBeInTheDocument();
  });

  it("verifies a claim only after asking, then lists the claims and counts the badge again", async () => {
    answer([JANE]);
    vi.mocked(axios.put).mockResolvedValue({ data: { data: { ...JANE, verified_at: "2026-11-01T12:00:00.000Z" } } });
    const recount = vi.fn<() => void>();
    const stop = onRecountBadges(recount);
    renderClaims();

    await screen.findByText("Jane Smith");
    fireEvent.click(within(rowOf("Jane Smith")).getByRole("button", { name: /Verify/ }));
    const dialog = await dialogTitled("Verify this claim?");
    expect(within(dialog).getByRole("link", { name: "the listing on Google Maps" })).toHaveAttribute("href", JANE.maps_url);
    expect(within(dialog).getByText(/leaves the directory's Google results/)).toBeInTheDocument();
    expect(axios.put).not.toHaveBeenCalled();

    answer([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(`${CLAIMS_URL}/12`, { action: "verify" }));
    expect(await screen.findByText("No claims waiting to be verified")).toBeInTheDocument();
    expect(listCalls()).toHaveLength(2);
    expect(recount).toHaveBeenCalled();
    stop();
  });

  it("since Nov 24, says which claims already hide their Google listing, before anyone checks them", async () => {
    // A live card's claim waiting to be checked, and a draft's, which hides nothing yet.
    const live = claim({ hides_listing: true });
    const draft = claim({ business_card_id: 14, name: "Ana Ruiz", status: "draft", hides_listing: false });
    answer([live, draft]);
    renderClaims();

    await screen.findByText("Jane Smith");
    expect(within(rowOf("Jane Smith")).getByText("Hidden from Google results")).toBeInTheDocument();
    expect(within(rowOf("Ana Ruiz")).getByText("Still in Google results")).toBeInTheDocument();

    fireEvent.click(within(rowOf("Jane Smith")).getByRole("button", { name: /Verify/ }));
    const verify = await dialogTitled("Verify this claim?");
    expect(within(verify).getByText(/already out of the directory's Google results/)).toBeInTheDocument();
    fireEvent.click(within(verify).getByRole("button", { name: "Cancel" }));

    // Rejecting a live card's claim brings its listing back, verified or not.
    fireEvent.click(within(rowOf("Jane Smith")).getByRole("button", { name: /Reject/ }));
    const reject = await dialogTitled("Reject this claim?");
    expect(within(reject).getByText("The Google listing shows in the directory again.")).toBeInTheDocument();
  });

  it("shows why a claim can't be verified when another card has the listing", async () => {
    answer([JANE]);
    vi.mocked(axios.put).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { code: "PLACE_ALREADY_CLAIMED", message: "Card 7 already has this listing." } },
    });
    renderClaims();

    await screen.findByText("Jane Smith");
    fireEvent.click(within(rowOf("Jane Smith")).getByRole("button", { name: /Verify/ }));
    const dialog = await dialogTitled("Verify this claim?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Verify" }));

    expect(await within(dialog).findByText("Card 7 already has this listing.")).toBeInTheDocument();
    expect(listCalls()).toHaveLength(1);
  });

  it("lists verified claims and rejects one after saying its listing comes back", async () => {
    answer([JANE]);
    renderClaims();
    await screen.findByText("Jane Smith");

    answer([LUMEN]);
    fireEvent.click(screen.getByRole("radio", { name: "Verified" }));
    expect(await screen.findByText("Mia Chen")).toBeInTheDocument();
    expect(listCalls().at(-1)?.[1]).toEqual({ params: { status: "verified", page: 1, limit: 50 } });
    const row = rowOf("Mia Chen");
    expect(within(row).getByText("Brand")).toBeInTheDocument();
    expect(within(row).getByText("Draft")).toBeInTheDocument();
    expect(within(row).getByText("Oct 31, 2026")).toBeInTheDocument();
    // Already verified: it can only be rejected.
    expect(within(row).queryByRole("button", { name: /Verify/ })).not.toBeInTheDocument();

    vi.mocked(axios.put).mockResolvedValue({
      data: { data: { ...LUMEN, place_id: null, verified_at: null, rejected: true } },
    });
    fireEvent.click(within(row).getByRole("button", { name: /Reject/ }));
    const dialog = await dialogTitled("Reject this claim?");
    expect(within(dialog).getByText("The Google listing shows in the directory again.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(`${CLAIMS_URL}/13`, { action: "reject" }));
  });
});
