import axios from "axios";
import { BASE_URL } from "../Host";
import type { ApiResponse } from "../../types/api";
import type { ProductTag, ProductTagDeleted, ProductTagFields } from "../../types/productTag";

// The products' tags (see types/productTag.ts). The list is public; the rest is for admins. A refusal is 400
// INVALID_TAG with `details.field` (an empty name, a name over 40 characters, an unknown id in an order), 409
// TAG_EXISTS (another tag has the name, ignoring case), or 404 for a tag that doesn't exist.

type Id = number | string;

const tags = `${BASE_URL}discover/shop/tags`;

/** Every tag, in their order. */
export const GetProductTags = async () => {
  return axios.get<ApiResponse<ProductTag[]>>(tags);
};

/** Answers the new tag. */
export const CreateProductTag = async (fields: Required<ProductTagFields>) => {
  return axios.post<ApiResponse<ProductTag>>(tags, fields);
};

/** Renames the tag, or makes it editorial or open; answers the tag. */
export const UpdateProductTag = async (id: Id, fields: ProductTagFields) => {
  return axios.put<ApiResponse<ProductTag>>(`${tags}/${id}`, fields);
};

/** The whole order: every tag's id once. */
export const OrderProductTags = async (ids: number[]) => {
  return axios.put<ApiResponse<unknown>>(`${tags}/order`, { ids });
};

/** Deletes the tag; the products that carried it lose it. */
export const DeleteProductTag = async (id: Id) => {
  return axios.delete<ApiResponse<ProductTagDeleted>>(`${tags}/${id}`);
};
