import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AccessOrders from "./AccessOrders";
import type { AccessOrder } from "../../types/businessCard";
import type { ShippingRate } from "../../types/access";

// No network in tests: each test says what the API answers.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), post: vi.fn<Call>(), patch: vi.fn<Call>() },
    // utils/apiError reads failures through this.
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const API = "https://api.test/api/v1/";

const keychainOrder: AccessOrder = {
  id: 7,
  order_number: "GL-20261020-000007",
  created_at: "2026-10-20T17:00:00.000Z",
  customer_name: "Jane Smith",
  customer_email: "jane@example.com",
  amount_paid: "44.99",
  shipping_amount: "5.00",
  payment_status: "paid",
  fulfillment_status: "pending",
  recipient_name: "Jane Smith",
  shipping_address_line_1: "1 Main St",
  shipping_city: "Las Vegas",
  shipping_state: "NV",
  shipping_postal_code: "89101",
  shipping_country: "US",
  carrier: "USPS",
  service: "Ground Advantage",
  shippo_rate_id: "rate_checkout",
  shippo_transaction_id: null,
  label_url: null,
  tracking_number: null,
  tracking_link: null,
  tracking_status: null,
  business_card: { business_card_link: "https://glamlink.net/jane-smith" },
};

// Access Pro bought alone: an order for the record, nothing to ship.
const proOrder: AccessOrder = {
  id: 8,
  order_number: "GL-20261021-000008",
  created_at: "2026-10-21T17:00:00.000Z",
  customer_name: "Lee Park",
  customer_email: "lee@example.com",
  amount_paid: "4.99",
  shipping_amount: "0.00",
  payment_status: "paid",
  fulfillment_status: null,
  shipping_address_line_1: null,
  business_card: { business_card_link: "https://glamlink.net/lee-park" },
};

const rate = (rate_id: string, provider: string, service: string, amount_cents: number, days: number): ShippingRate => ({
  rate_id,
  amount_cents,
  currency: "usd",
  provider,
  service,
  service_token: null,
  estimated_days: days,
  duration_terms: null,
  attributes: [],
});

/** Answers each GET by its path under the API. */
const answerGets = (routes: Record<string, unknown>) => {
  vi.mocked(axios.get).mockImplementation((url) => {
    const path = String(url).replace(API, "");
    return path in routes
      ? Promise.resolve({ data: { success: true, data: routes[path] } })
      : Promise.reject(new Error(`No answer for GET ${path}`));
  });
};

const ordersList = {
  data: [keychainOrder, proOrder],
  pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
};

// The admin's order email links to /access-orders/:id, which opens that order.
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/access-orders/:id?" element={<AccessOrders />} />
      </Routes>
    </MemoryRouter>,
  );

/** The rate picker that "Buy label" opens over the order's details. */
const openRatePicker = async (details: HTMLElement) => {
  fireEvent.click(within(details).getByRole("button", { name: /Buy label/ }));
  const title = await screen.findByText("Buy a label for GL-20261020-000007");
  return title.closest<HTMLElement>('[role="dialog"]')!;
};

/** The confirmation that "Cancel order" opens over the order's details. */
const openCancel = async (details: HTMLElement) => {
  fireEvent.click(within(details).getByRole("button", { name: /Cancel order/ }));
  const title = await screen.findByText("Cancel order GL-20261020-000007?");
  return title.closest<HTMLElement>('[role="dialog"]')!;
};

const LIST_URL = `${API}businessCard/access-orders`;
const listCalls = () => vi.mocked(axios.get).mock.calls.filter(([url]) => url === LIST_URL);

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

/** The list's row for an order (its number also shows in the details). */
const rowOf = (orderNumber: string) =>
  screen
    .getAllByText(orderNumber)
    .map((el) => el.closest("tr"))
    .find(Boolean) as HTMLElement;

describe("Access orders: shipping labels", () => {
  it("buys the label with the rate picked and shows it, ready to print", async () => {
    answerGets({
      "businessCard/access-orders": ordersList,
      "businessCard/access-orders/7": keychainOrder,
      "businessCard/access-orders/7/rates": {
        order_id: 7,
        shipment_id: "shp_1",
        rates: [rate("rate_cheap", "USPS", "Ground Advantage", 450, 4), rate("rate_fast", "UPS", "Next Day Air", 2500, 1)],
      },
    });
    const { business_card: _card, ...withoutCard } = keychainOrder;
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        data: {
          ...withoutCard,
          fulfillment_status: "processing",
          carrier: "UPS",
          service: "Next Day Air",
          shippo_rate_id: "rate_fast",
          shippo_transaction_id: "tr_1",
          label_url: "https://labels.example/7.pdf",
          label_created_at: "2026-10-22T17:00:00.000Z",
          tracking_number: "1Z999AA10123456784",
          tracking_link: "https://track.example/1Z999AA10123456784",
        },
      },
    });
    renderAt("/access-orders/7");

    const details = await screen.findByRole("dialog");
    const picker = await openRatePicker(details);
    // The first choice is the checkout's rate; this one is picked instead.
    expect(within(picker).getByRole("radio", { name: /The rate chosen at checkout: USPS Ground Advantage/ })).toBeChecked();
    fireEvent.click(await within(picker).findByRole("radio", { name: /UPS Next Day Air/ }));
    fireEvent.click(within(picker).getByRole("button", { name: /Buy label/ }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(`${API}businessCard/access-orders/7/label`, { rate_id: "rate_fast" }),
    );
    expect(await within(details).findByRole("link", { name: /Print label/ })).toHaveAttribute(
      "href",
      "https://labels.example/7.pdf",
    );
    expect(within(details).getByRole("link", { name: /1Z999AA10123456784/ })).toHaveAttribute(
      "href",
      "https://track.example/1Z999AA10123456784",
    );
    // The hand-edited tracking below follows the label, so saving it doesn't undo it.
    expect(within(details).getByDisplayValue("1Z999AA10123456784")).toBeInTheDocument();
    expect(within(details).getByRole("button", { name: /Void label/ })).toBeInTheDocument();
  });

  it("buys with the checkout's rate by default and shows Shippo's reasons when it fails", async () => {
    answerGets({
      "businessCard/access-orders": ordersList,
      "businessCard/access-orders/7": keychainOrder,
      "businessCard/access-orders/7/rates": { order_id: 7, shipment_id: "shp_1", rates: [] },
    });
    vi.mocked(axios.post).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 422,
        data: { message: "Shippo couldn't make the label: The address is not deliverable", code: "LABEL_FAILED" },
      },
    });
    renderAt("/access-orders/7");

    const picker = await openRatePicker(await screen.findByRole("dialog"));
    fireEvent.click(within(picker).getByRole("button", { name: /Buy label/ }));

    expect(
      await within(picker).findByText("Shippo couldn't make the label: The address is not deliverable"),
    ).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith(`${API}businessCard/access-orders/7/label`, {});
  });

  it("says a label may have been bought when the server doesn't answer (Cloudflare's own page, no message)", async () => {
    answerGets({
      "businessCard/access-orders": ordersList,
      "businessCard/access-orders/7": keychainOrder,
      "businessCard/access-orders/7/rates": { order_id: 7, shipment_id: "shp_1", rates: [] },
    });
    vi.mocked(axios.post).mockRejectedValue({ isAxiosError: true, response: { status: 504, data: "error code: 504" } });
    renderAt("/access-orders/7");

    const picker = await openRatePicker(await screen.findByRole("dialog"));
    fireEvent.click(within(picker).getByRole("button", { name: /Buy label/ }));

    expect(await within(picker).findByText(/the server didn't answer.*the label may have been bought/)).toBeInTheDocument();
  });

  it("names the shipping the customer chose, and which of today's rates is each option", async () => {
    const expedited: AccessOrder = { ...keychainOrder, shipping_option: "expedited", carrier: "USPS", service: "Priority Mail" };
    answerGets({
      "businessCard/access-orders": { ...ordersList, data: [expedited, proOrder] },
      "businessCard/access-orders/7": expedited,
      "businessCard/access-orders/7/rates": {
        order_id: 7,
        shipment_id: "shp_1",
        rates: [
          { ...rate("rate_ga", "USPS", "Ground Advantage", 450, 4), option: "standard" },
          { ...rate("rate_pm", "USPS", "Priority Mail", 900, 2), option: "expedited" },
          { ...rate("rate_air", "UPS", "2nd Day Air", 1200, 2), option: null },
        ],
      },
    });
    renderAt("/access-orders/7");

    const details = await screen.findByRole("dialog");
    expect(within(details).getByText("Expedited Shipping")).toBeInTheDocument();
    const picker = await openRatePicker(details);
    expect(
      within(picker).getByRole("radio", { name: /The rate chosen at checkout: USPS Priority Mail \(Expedited Shipping\)/ }),
    ).toBeChecked();
    const priority = (await within(picker).findByRole("radio", { name: /USPS Priority Mail · \$9\.00/ })).closest("label")!;
    expect(within(priority).getByText("Expedited Shipping today")).toBeInTheDocument();
    expect(within(priority).getByText("Chosen at checkout")).toBeInTheDocument();
  });

  it("shows a label Shippo is still making, and picks it up with Check again", async () => {
    const pending: AccessOrder = { ...keychainOrder, shippo_transaction_id: "tr_1", label_url: null };
    answerGets({
      "businessCard/access-orders": { ...ordersList, data: [pending, proOrder] },
      "businessCard/access-orders/7": pending,
    });
    const { business_card: _card, ...withoutCard } = pending;
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        data: {
          ...withoutCard,
          fulfillment_status: "processing",
          label_url: "https://labels.example/7.pdf",
          label_created_at: "2026-11-16T17:00:00.000Z",
          tracking_number: "9400111899223197428490",
        },
      },
    });
    renderAt("/access-orders/7");

    const details = await screen.findByRole("dialog");
    expect(within(details).getByText(/Shippo is still making this label/)).toBeInTheDocument();
    expect(within(details).queryByRole("button", { name: /Void label/ })).not.toBeInTheDocument();
    fireEvent.click(within(details).getByRole("button", { name: /Check again/ }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(`${API}businessCard/access-orders/7/label`, {}));
    expect(await within(details).findByRole("link", { name: /Print label/ })).toHaveAttribute(
      "href",
      "https://labels.example/7.pdf",
    );
  });
});

describe("Access orders: Access Pro alone", () => {
  it("lists it as Access Pro only, with nothing to ship and no label actions", async () => {
    answerGets({ "businessCard/access-orders": ordersList, "businessCard/access-orders/8": proOrder });
    renderAt("/access-orders");

    expect(await screen.findByText("GL-20261021-000008")).toBeInTheDocument();
    expect(screen.getByText("Access Pro only")).toBeInTheDocument();
    expect(screen.getByText("Nothing to ship")).toBeInTheDocument();
  });

  it("shows nothing to ship in its details", async () => {
    answerGets({ "businessCard/access-orders": ordersList, "businessCard/access-orders/8": proOrder });
    renderAt("/access-orders/8");

    const details = await screen.findByRole("dialog");
    expect(await within(details).findByText("Access Pro only: nothing to ship.")).toBeInTheDocument();
    expect(within(details).queryByRole("button", { name: /Buy label/ })).not.toBeInTheDocument();
    expect(within(details).queryByText("Shipping label")).not.toBeInTheDocument();
  });
});

describe("Access orders: the list", () => {
  it("pages, searches and filters on the server", async () => {
    answerGets({
      "businessCard/access-orders": { data: [keychainOrder, proOrder], pagination: { total: 120, page: 1, limit: 50 } },
    });
    renderAt("/access-orders");

    expect(await screen.findByText("GL-20261020-000007")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(LIST_URL, { params: { page: 1, limit: 50 } });
    // Pages by the API's total, at the page size it used.
    expect(screen.getByText("120 orders")).toBeInTheDocument();
    expect(screen.getByTitle("3")).toBeInTheDocument();
    expect(screen.queryByTitle("4")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search by name, email or order #"), { target: { value: " jane " } });
    await waitFor(() => expect(listCalls().at(-1)?.[1]).toEqual({ params: { page: 1, limit: 50, search: "jane" } }));

    await choose(screen.getByRole("combobox", { name: "Fulfillment" }), "Shipped");
    await waitFor(() =>
      expect(listCalls().at(-1)?.[1]).toEqual({
        params: { page: 1, limit: 50, search: "jane", fulfillment_status: "shipped" },
      }),
    );

    await choose(screen.getByRole("combobox", { name: "Payment" }), "Refunded");
    await waitFor(() =>
      expect(listCalls().at(-1)?.[1]).toEqual({
        params: { page: 1, limit: 50, search: "jane", payment_status: "refunded", fulfillment_status: "shipped" },
      }),
    );

    fireEvent.click(screen.getByTitle("2"));
    await waitFor(() =>
      expect(listCalls().at(-1)?.[1]).toEqual({
        params: { page: 2, limit: 50, search: "jane", payment_status: "refunded", fulfillment_status: "shipped" },
      }),
    );
  });

  it("tags cancelled orders, whichever status says so, and offers no fulfillment for them", async () => {
    const cancelledKeychain: AccessOrder = {
      ...keychainOrder,
      id: 9,
      order_number: "GL-20261022-000009",
      payment_status: "cancelled",
    };
    const cancelledPro: AccessOrder = { ...proOrder, id: 10, order_number: "GL-20261023-000010", fulfillment_status: "cancelled" };
    answerGets({
      "businessCard/access-orders": { data: [cancelledKeychain, cancelledPro], pagination: { total: 2, page: 1, limit: 50 } },
    });
    renderAt("/access-orders");

    await screen.findByText("GL-20261022-000009");
    const keychainRow = rowOf("GL-20261022-000009");
    expect(within(keychainRow).getByText("Cancelled")).toBeInTheDocument();
    expect(within(keychainRow).queryByRole("combobox")).not.toBeInTheDocument();
    // Said once, by the tag.
    expect(within(keychainRow).queryByText("CANCELLED")).not.toBeInTheDocument();
    expect(within(keychainRow).getByText("1 Main St")).toBeInTheDocument();

    const proRow = rowOf("GL-20261023-000010");
    expect(within(proRow).getByText("Cancelled")).toBeInTheDocument();
    expect(within(proRow).getByText("PAID")).toBeInTheDocument();
    expect(within(proRow).getByText("Access Pro only")).toBeInTheDocument();
  });

  it("reads a cancellation from cancelled_at, as the API answers it, and filters cancelled orders with cancelled=true", async () => {
    // The API keeps the payment status ("paid": refunds are made by hand) and sets cancelled_at.
    const cancelledPro: AccessOrder = { ...proOrder, id: 11, order_number: "GL-20261024-000011", cancelled_at: "2026-11-01T10:00:00Z" };
    answerGets({
      "businessCard/access-orders": { data: [cancelledPro], pagination: { total: 1, page: 1, limit: 50 } },
    });
    renderAt("/access-orders");

    await screen.findByText("GL-20261024-000011");
    const row = rowOf("GL-20261024-000011");
    expect(within(row).getByText("Cancelled")).toBeInTheDocument();
    expect(within(row).getByText("PAID")).toBeInTheDocument();

    await choose(screen.getByRole("combobox", { name: "Payment" }), "Cancelled");
    await waitFor(() => expect(listCalls().at(-1)?.[1]).toEqual({ params: { page: 1, limit: 50, cancelled: "true" } }));
  });
});

describe("Access orders: cancelling", () => {
  it("cancels an order only after saying what happens, then shows it cancelled", async () => {
    answerGets({ "businessCard/access-orders": ordersList, "businessCard/access-orders/7": keychainOrder });
    const { business_card: _card, ...withoutCard } = keychainOrder;
    vi.mocked(axios.post).mockResolvedValue({ data: { data: { ...withoutCard, fulfillment_status: "cancelled" } } });
    renderAt("/access-orders/7");

    const details = await screen.findByRole("dialog");
    const confirm = await openCancel(details);
    expect(
      within(confirm).getByText(
        "Marks the order cancelled, stops an unshipped keychain, and ends the Access Pro subscription bought with it right away. No refund is made: refund a keychain manually in Stripe if needed. Subscriptions are not refunded.",
      ),
    ).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();

    fireEvent.change(within(confirm).getByLabelText("Reason (optional)"), { target: { value: " Ordered twice " } });
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel order" }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(`${API}businessCard/access-orders/7/cancel`, { reason: "Ordered twice" }),
    );
    expect(await within(details).findByText("This order is cancelled")).toBeInTheDocument();
    expect(within(details).getByText("CANCELLED")).toBeInTheDocument();
    // Nothing left to buy, change or cancel.
    expect(within(details).queryByRole("button", { name: /Buy label/ })).not.toBeInTheDocument();
    expect(within(details).queryByRole("button", { name: /Cancel order/ })).not.toBeInTheDocument();
    expect(within(details).queryByText("Tracking Number")).not.toBeInTheDocument();
    // The list follows.
    expect(within(rowOf("GL-20261020-000007")).getByText("Cancelled")).toBeInTheDocument();
  });

  it("shows the API's reason when it can't be cancelled, and the order as it is now", async () => {
    answerGets({ "businessCard/access-orders": ordersList, "businessCard/access-orders/7": keychainOrder });
    vi.mocked(axios.post).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { code: "ORDER_SHIPPED", message: "Its keychain has shipped, so the order can't be cancelled." },
      },
    });
    renderAt("/access-orders/7");

    const confirm = await openCancel(await screen.findByRole("dialog"));
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel order" }));

    expect(
      await within(confirm).findByText("Its keychain has shipped, so the order can't be cancelled."),
    ).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith(`${API}businessCard/access-orders/7/cancel`, {});
    // The details behind it are loaded again.
    await waitFor(() =>
      expect(vi.mocked(axios.get).mock.calls.filter(([url]) => url === `${API}businessCard/access-orders/7`)).toHaveLength(2),
    );
  });
});

describe("Access orders: what Stripe recorded, and the checkout", () => {
  it("words a partial refund as such, with how much of what was paid", async () => {
    const partly = {
      ...keychainOrder,
      payment_status: "partially_refunded",
      refunded_amount: "5.00",
      refunded_at: "2026-11-02T18:00:00.000Z",
    };
    answerGets({ "businessCard/access-orders": ordersList, "businessCard/access-orders/7": partly });
    renderAt("/access-orders/7");

    const details = await screen.findByRole("dialog");
    expect(await within(details).findByText("Partly refunded")).toBeInTheDocument();
    expect(within(details).getByText(/^\$5\.00 of \$44\.99 was refunded in Stripe on Nov 02, 2026/)).toBeInTheDocument();
    expect(within(details).getByText(/A refund changes no plan, seat or shipping/)).toBeInTheDocument();
    expect(within(details).getByText("PARTLY REFUNDED")).toBeInTheDocument();
  });

  it("shows a full refund", async () => {
    const refunded = { ...proOrder, payment_status: "refunded", refunded_amount: "4.99", refunded_at: "2026-11-02T18:00:00.000Z" };
    answerGets({ "businessCard/access-orders": ordersList, "businessCard/access-orders/8": refunded });
    renderAt("/access-orders/8");

    const details = await screen.findByRole("dialog");
    expect(await within(details).findByText("Refunded in full")).toBeInTheDocument();
    expect(within(details).getByText(/^\$4\.99 was refunded in Stripe on/)).toBeInTheDocument();
  });

  it("shows an open dispute with Stripe's status, and a settled one as settled", async () => {
    const disputed = {
      ...keychainOrder,
      payment_status: "disputed",
      dispute_status: "needs_response",
      disputed_at: "2026-11-02T18:00:00.000Z",
    };
    answerGets({ "businessCard/access-orders": ordersList, "businessCard/access-orders/7": disputed });
    const { unmount } = renderAt("/access-orders/7");

    let details = await screen.findByRole("dialog");
    expect(await within(details).findByText("Disputed")).toBeInTheDocument();
    expect(
      within(details).getByText(/disputed the payment on Nov 02, 2026.* Stripe says: needs a response\. Answer it in Stripe's dashboard/),
    ).toBeInTheDocument();
    expect(within(details).getByText("DISPUTED")).toBeInTheDocument();
    unmount();

    answerGets({
      "businessCard/access-orders": ordersList,
      "businessCard/access-orders/7": { ...disputed, payment_status: "paid", dispute_status: "won" },
    });
    renderAt("/access-orders/7");
    details = await screen.findByRole("dialog");
    expect(await within(details).findByText("A dispute was settled")).toBeInTheDocument();
    expect(within(details).getByText(/Stripe says: won\. The payment stands\./)).toBeInTheDocument();
  });

  it("dates a cancellation, and shows a purchase that was paid but not given", async () => {
    const cancelled = { ...proOrder, cancelled_at: "2026-11-01T18:00:00.000Z", cancel_reason: "Ordered twice" };
    answerGets({ "businessCard/access-orders": ordersList, "businessCard/access-orders/8": cancelled });
    const { unmount } = renderAt("/access-orders/8");

    let details = await screen.findByRole("dialog");
    expect(await within(details).findByText(/^Cancelled Nov 01, 2026, .* PT\. Nothing more ships for it.* Reason: Ordered twice$/)).toBeInTheDocument();
    unmount();

    // Paid, but the API couldn't give it: the order isn't cancelled, and says to refund it.
    const notGiven = { ...proOrder, cancel_reason: "Paid but not given (a second Access Pro): refund it in Stripe." };
    answerGets({ "businessCard/access-orders": ordersList, "businessCard/access-orders/8": notGiven });
    renderAt("/access-orders/8");
    details = await screen.findByRole("dialog");
    expect(await within(details).findByText("Paid but not given")).toBeInTheDocument();
    expect(within(details).getByText("Paid but not given (a second Access Pro): refund it in Stripe.")).toBeInTheDocument();
    expect(within(details).queryByText("This order is cancelled")).not.toBeInTheDocument();
  });

  it("names what the checkout bought and its ids at Stripe", async () => {
    const withCheckout = {
      ...keychainOrder,
      checkout: {
        id: 41,
        plan_type: "nfc_with_subscription",
        status: "paid",
        stripe_subscription_id: "sub_123",
        stripe_payment_intent_id: null,
        stripe_invoice_id: "in_456",
      },
    };
    answerGets({ "businessCard/access-orders": ordersList, "businessCard/access-orders/7": withCheckout });
    renderAt("/access-orders/7");

    const details = await screen.findByRole("dialog");
    expect(await within(details).findByText("Access Pro + NFC keychain")).toBeInTheDocument();
    expect(within(details).getByText("sub_123")).toBeInTheDocument();
    expect(within(details).getByText("in_456")).toBeInTheDocument();
    expect(within(details).queryByText("Payment in Stripe")).not.toBeInTheDocument();
    // Nothing refunded or disputed: nothing said about it.
    expect(within(details).queryByText(/refunded in Stripe/)).not.toBeInTheDocument();
    expect(within(details).queryByText("Disputed")).not.toBeInTheDocument();
  });
});
