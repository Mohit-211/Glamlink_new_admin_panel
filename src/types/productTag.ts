// Product tags (Nov 4). A product carries at most one tag, shown top-left on its card and its page; admins keep the
// list. An editorial tag is an admin's to set, so owners can't claim a feature they didn't get; owners may set an open
// one on their own products. Backend: GET /discover/shop/tags (public) and the admin calls beside it.

/** A tag, as GET /discover/shop/tags lists it (by `sort_order`, then by name) and as the admin calls answer it. */
export interface ProductTag {
  id: number;
  /** At most 40 characters, unique ignoring case. */
  name: string;
  /** Only admins may set it on a product. */
  is_editorial: boolean;
  sort_order: number;
}

/** A product's tag, on every product row (null when it has none). */
export type ProductTagRef = Pick<ProductTag, "id" | "name" | "is_editorial">;

/** POST /discover/shop/tags takes both; PUT /discover/shop/tags/:id changes the ones sent. */
export interface ProductTagFields {
  name?: string;
  is_editorial?: boolean;
}

/** What DELETE /discover/shop/tags/:id answers: the products that carried the tag lose it. */
export interface ProductTagDeleted {
  id: number;
  products_untagged: number;
}
