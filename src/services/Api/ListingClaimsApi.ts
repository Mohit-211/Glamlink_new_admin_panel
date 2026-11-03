import axios from "axios";
import { BASE_URL } from "../Host";
import type { ApiResponse, Paged } from "../../types/api";
import type { ClaimAction, ClaimListParams, ListingClaim } from "../../types/listingClaim";

// Claims of the directory's Google listings, made through the Access form (see types/listingClaim.ts).
// A missing claim is 404 NOT_FOUND; an unknown action is 400.

type Id = number | string;

/** The cards that claim a Google listing, pending first; 50 a page at most. */
export const GetListingClaims = async (params: ClaimListParams = {}) => {
  return axios.get<ApiResponse<Paged<ListingClaim>>>(`${BASE_URL}directory/claims`, { params });
};

/** How many claims wait to be verified (for the sidebar's badge). */
export const GetPendingClaimCount = async (): Promise<number> => {
  const res = await GetListingClaims({ status: "pending", limit: 1 });
  return res.data.data.count;
};

/**
 * Verifies or rejects the card's claim and answers the claim as it is now. 409 PLACE_ALREADY_CLAIMED (its message names
 * the card) when another card's verified claim has the listing.
 */
export const ReviewListingClaim = async (cardId: Id, action: ClaimAction) => {
  return axios.put<ApiResponse<ListingClaim>>(`${BASE_URL}directory/claims/${cardId}`, { action });
};
