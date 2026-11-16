import axios from "axios";
import { BASE_URL } from "../Host";
import type { ApiResponse } from "../../types/api";
import type {
  AccessOrder,
  AccessOrderListParams,
  BusinessCard,
  FeaturedLink,
  FulfillmentUpdate,
} from "../../types/businessCard";
import type { OrderRates, VoidedLabel } from "../../types/access";

type Id = number | string;

export const UpdateStatus = async (formData: FormData) => {
  return await axios.put<ApiResponse<unknown>>(
    BASE_URL + `businessCard/updateBusinessCardStatus`,
    formData,
  );
};

/** Every card but guest drafts; `status` lists only that status ("draft" lists the drafts). */
export const GetAllBusinessCards = async (status?: BusinessCard["status"]) => {
  return await axios.get<ApiResponse<BusinessCard[]>>(BASE_URL + `businessCard/getAllBusinessCards`, {
    params: status ? { status } : undefined,
  });
};

export const DeleteBusinessCard = async (category_id: React.Key[]) => {
  return await axios.post<ApiResponse<unknown>>(`${BASE_URL}businessCard/delete`, {
    category_id: category_id,
  });
};

export const GenerateBusinessCard = async (formData: FormData) => {
  return await axios.post<ApiResponse<BusinessCard>>(BASE_URL + "businessCard/createBusinessCardByAdmin", formData);
};

export const GetBusinessCardById = async (id: Id) => {
  return await axios.get<ApiResponse<BusinessCard>>(BASE_URL + `businessCard/getBusinessCardById/${id}`);
};

export const UpdateBusinessCard = async (id: Id, formData: FormData) => {
  return await axios.put<ApiResponse<BusinessCard>>(
    BASE_URL + `businessCard/updateBusinessCard/${id}`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data"
      },
    },
  );
};

/** A page of orders, newest first, with how many match in all. `limit` is the page size the API used. */
export interface AccessOrderPage {
  data: AccessOrder[];
  pagination?: { total: number; page: number; limit: number; totalPages?: number };
}

/** One page of orders, searched and filtered by the API; `pagination.total` counts every order that matches. */
export const GetAllAccessOrders = async (params: AccessOrderListParams = {}) => {
  return await axios.get<ApiResponse<AccessOrderPage>>(BASE_URL + `businessCard/access-orders`, {
    params,
  });
};

export const GetAccessOrderById = async (id: Id) => {
  return await axios.get<ApiResponse<AccessOrder> | AccessOrder>(BASE_URL + `businessCard/access-orders/${id}`);
};

/** The order in a GetAccessOrderById body, whichever shape it came in. */
export const accessOrderFromResponse = (body: ApiResponse<AccessOrder> | AccessOrder): AccessOrder =>
  "order_number" in body ? body : body.data;

export const UpdateAccessOrderFulfillment = async (id: Id, formData: FulfillmentUpdate) => {
  return await axios.patch<ApiResponse<AccessOrder>>(
    BASE_URL + `businessCard/access-orders/${id}/fulfillment`,
    formData,
  );
};

/** Today's Shippo rates for an order's keychain parcel, cheapest first. 400 NOTHING_TO_SHIP for an order with no parcel. */
export const GetAccessOrderRates = async (id: Id) => {
  return axios.get<ApiResponse<OrderRates>>(`${BASE_URL}businessCard/access-orders/${id}/rates`);
};

/**
 * Buys the order's label: `rateId` (one of today's rates), else the rate chosen at checkout while Shippo sells it, else
 * today's rate for the same service or option (else the standard one). Answers the order, now processing, with its
 * tracking number and `label_url`; without them while Shippo is still making the label (asking again picks it up).
 * 409 LABEL_EXISTS or LABEL_PENDING; 422 LABEL_FAILED with Shippo's reasons in the message; 503 SHIPPO_UNAVAILABLE
 * (a label may have been made); 400 NOTHING_TO_SHIP or NO_SHIPPING_RATES.
 */
export const BuyAccessOrderLabel = async (id: Id, rateId?: string) => {
  return axios.post<ApiResponse<AccessOrder>>(
    `${BASE_URL}businessCard/access-orders/${id}/label`,
    rateId ? { rate_id: rateId } : {},
  );
};

/** Voids an unused label (Shippo refunds it); the order goes back to pending. 409 LABEL_IN_USE once it has shipped. */
export const VoidAccessOrderLabel = async (id: Id) => {
  return axios.post<ApiResponse<VoidedLabel>>(`${BASE_URL}businessCard/access-orders/${id}/label/void`);
};

/**
 * Cancels the order and answers it: an unshipped keychain is stopped, and the Access Pro subscription bought with it
 * ends at once. Nothing is refunded (a keychain is refunded by hand in Stripe; subscriptions never are). 404; 409 when
 * it is already cancelled, or (perhaps) when its keychain has shipped, with the reason in the message.
 */
export const CancelAccessOrder = async (id: Id, reason?: string) => {
  return axios.post<ApiResponse<AccessOrder>>(
    `${BASE_URL}businessCard/access-orders/${id}/cancel`,
    reason ? { reason } : {},
  );
};

export const ReorderFeaturedLinks = async (
  businessCardId: Id,
  featured_links: FeaturedLink[],
) => {
  return await axios.put<ApiResponse<unknown>>(BASE_URL +
    `businessCard/${businessCardId}/featured-links/reorder`, {
    featured_links,
  });
};
