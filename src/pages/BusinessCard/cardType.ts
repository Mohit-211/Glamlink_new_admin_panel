import type { BusinessCard, CardType } from "../../types/businessCard";

// Who a card is for: a beauty or wellness professional, or a brand. The Access form asks "Professional or Brand";
// the API calls a professional "individual" (`professional_type`).

export const CARD_TYPE_LABEL: Record<CardType, string> = { individual: "Professional", brand: "Brand" };

/** Tag colours, as on the pages list. */
export const CARD_TYPE_COLOR: Record<CardType, string> = { individual: "geekblue", brand: "purple" };

export const CARD_TYPE_OPTIONS: { value: CardType; label: string }[] = [
  { value: "individual", label: CARD_TYPE_LABEL.individual },
  { value: "brand", label: CARD_TYPE_LABEL.brand },
];

/** A card's type; a card without one (saved before types) is a professional's. */
export const cardTypeOf = (card: Pick<BusinessCard, "professional_type">): CardType =>
  card.professional_type === "brand" ? "brand" : "individual";
