import { describe, expect, it } from "vitest";
import { PRODUCT_CATEGORIES, appendProductSiteFields } from "./ProductSiteFields";
import { appendTileFields } from "../../../JournalTopics/TopicTileFields";

const sent = (fill: (data: FormData) => void) => {
  const data = new FormData();
  fill(data);
  return Object.fromEntries(data.entries());
};

describe("A product's website fields", () => {
  it("sends the owner, brand, featuring and description", () => {
    expect(
      sent((d) =>
        appendProductSiteFields(d, {
          slug: " glow-serum ",
          description: "Two paragraphs.\n\nSecond.",
          owner_id: 12,
          brand_id: 40,
          is_featured: true,
          featured_order: 2,
        }),
      ),
    ).toEqual({
      slug: "glow-serum",
      description: "Two paragraphs.\n\nSecond.",
      owner_id: "12",
      brand_id: "40",
      is_featured: "true",
      featured_order: "2",
      category: "",
      tag_id: "",
      button_label: "",
    });
  });

  it("clears the owner and brand with an empty value and leaves a blank slug out", () => {
    // A blank slug would change nothing on an edit; on a new product the API makes one from the title.
    expect(sent((d) => appendProductSiteFields(d, { slug: "", owner_id: null, brand_id: null }))).toEqual({
      description: "",
      owner_id: "",
      brand_id: "",
      is_featured: "false",
      category: "",
      tag_id: "",
      button_label: "",
    });
  });

  it("sends the category by its label, the tag's id and the button's label, trimmed", () => {
    expect(
      sent((d) => appendProductSiteFields(d, { category: "Body & Bath", tag_id: 2, button_label: "  Book a demo " })),
    ).toMatchObject({ category: "Body & Bath", tag_id: "2", button_label: "Book a demo" });
  });

  it("clears the category, the tag and the button's label with an empty value", () => {
    // An empty label: the button says "Shop now".
    expect(sent((d) => appendProductSiteFields(d, { category: "", tag_id: "", button_label: "   " }))).toMatchObject({
      category: "",
      tag_id: "",
      button_label: "",
    });
  });

  it("leaves out a category saved before the list of eight, so it stays as it is", () => {
    // The API takes only the eight: sending the old value back would refuse the whole save.
    const fields = sent((d) => appendProductSiteFields(d, { category: "Beauty", tag_id: 3, button_label: "" }));
    expect(fields).not.toHaveProperty("category");
    expect(fields).toMatchObject({ tag_id: "3", button_label: "" });
  });

  it("offers the shop's eight categories, in the website's order", () => {
    expect(PRODUCT_CATEGORIES).toEqual([
      "Skincare",
      "Haircare",
      "Makeup",
      "Nails",
      "Body & Bath",
      "Fragrance",
      "Wellness & Supplements",
      "Devices & Tools",
    ]);
  });
});

describe("A topic's home page tile fields", () => {
  it("sends the tile and its order", () => {
    expect(
      sent((d) => appendTileFields(d, { is_featured: true, featured_order: 3, tile_image: "https://api.test/images/t.jpg" })),
    ).toEqual({ is_featured: "true", featured_order: "3", tile_image: "https://api.test/images/t.jpg" });
  });

  it("removes the tile image with an empty value", () => {
    expect(sent((d) => appendTileFields(d, { is_featured: false, featured_order: null }))).toEqual({
      is_featured: "false",
      tile_image: "",
    });
  });
});
