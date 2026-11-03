import type { CardStatus, CardType } from "./businessCard";

// Claims of Google listings. Someone who finds their business among the directory's Google listings claims it from
// the Access form, and their card keeps the listing's place id. An admin verifies the claim; only then does the Google
// listing leave the directory. Backend: website/directory (directory.service.js, claims).

/** Pending: waiting for an admin; verified: the Google listing has left the directory. */
export type ClaimStatus = "pending" | "verified";

/** A card that claims a Google listing: GET /directory/claims rows, and what PUT /directory/claims/:cardId answers. */
export interface ListingClaim {
  business_card_id: number;
  /** The card's name and business. */
  name: string;
  business_name: string | null;
  email: string | null;
  professional_type: CardType;
  /** The card's own status. */
  status: CardStatus;
  /** The card's account. */
  user_id: number | null;
  /** The Google listing claimed; null in the answer to a reject. */
  place_id: string | null;
  /** When an admin verified it; null while it waits. */
  verified_at: string | null;
  /** When the card, and its claim, was made: claims come only with a new card. */
  created_at: string;
  /** Google's page for the listing, to compare with the card. */
  maps_url: string;
  /** Only in the answer to a reject. */
  rejected?: boolean;
}

/** GET /directory/claims: pending claims first, then newest first. */
export interface ClaimListParams {
  /** Every claim when left out. */
  status?: ClaimStatus;
  page?: number;
  /** 12 by default, at most 50. */
  limit?: number;
}

/**
 * PUT /directory/claims/:cardId. Verify takes the Google listing out of the directory (409 PLACE_ALREADY_CLAIMED when
 * another card's verified claim has it); reject clears the claim from the card, and the listing stays or comes back.
 */
export type ClaimAction = "verify" | "reject";
