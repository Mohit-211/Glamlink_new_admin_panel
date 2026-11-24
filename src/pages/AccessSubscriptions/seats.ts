import type { SeatSource, SeatStatus, SubscriptionSeat } from "../../types/access";

// How an Access Pro seat reads, on the Subscriptions screen and in the Professionals list.

// Pro while active, on trial, or past due (Stripe is retrying a payment).
const PRO_STATUSES: SeatStatus[] = ["active", "trialing", "past_due"];
export const isPro = (seat: SubscriptionSeat) => PRO_STATUSES.includes(seat.status);

export const SEAT_STATUS: Partial<Record<string, { label: string; color?: string; hint?: string }>> = {
  active: { label: "Active", color: "green" },
  trialing: { label: "Trial", color: "cyan" },
  past_due: { label: "Past due", color: "orange", hint: "A renewal failed and Stripe is retrying; they keep Pro meanwhile." },
  canceled: { label: "Canceled" },
  incomplete: { label: "Incomplete", color: "gold", hint: "The first payment hasn't gone through." },
  incomplete_expired: { label: "Never paid", hint: "The first payment never went through." },
  unpaid: { label: "Unpaid", color: "red", hint: "Stripe stopped retrying; they no longer have Pro." },
  paused: { label: "Paused" },
};

export const SEAT_SOURCE_LABEL: Record<SeatSource, string> = { stripe: "Stripe", comp: "Complimentary" };
