import React, { useEffect, useState } from "react";
import { Card, Col, Form, Input, InputNumber, Row, Select, Space, Switch, Tag, message } from "antd";
import AccountSelect from "../../../../components/AccountSelect";
import { GetProductTags } from "../../../../services/Api/ProductTagsApi";
import { websiteUrl } from "../../../../utils/website";
import type { Shop } from "../../../../types/journal";
import type { ProductTag, ProductTagRef } from "../../../../types/productTag";

/** The shop's categories, in the website's order. A product stores the label; the API refuses any other value. */
export const PRODUCT_CATEGORIES = [
  "Skincare",
  "Haircare",
  "Makeup",
  "Nails",
  "Body & Bath",
  "Fragrance",
  "Wellness & Supplements",
  "Devices & Tools",
] as const;

const isProductCategory = (value: string) => (PRODUCT_CATEGORIES as readonly string[]).includes(value);

/** The API's limit on the product's button. */
const BUTTON_LABEL_MAX = 30;

/** The form values of the fields below. */
export interface ProductSiteValues {
  slug?: string;
  description?: string;
  owner_id?: number | null;
  brand_id?: number | null;
  is_featured?: boolean;
  featured_order?: number | null;
  /** A category's label; "" for none. */
  category?: string;
  /** The tag's id; "" for none. */
  tag_id?: number | "";
  /** "" for none: the button says "Shop now". */
  button_label?: string;
}

/** A loaded product's values for these fields. */
export const productSiteValues = (shop: Shop): ProductSiteValues => ({
  slug: shop.slug ?? "",
  description: shop.description ?? "",
  owner_id: shop.owner_id ?? null,
  brand_id: shop.brand_id ?? null,
  is_featured: Boolean(shop.is_featured),
  featured_order: shop.featured_order ?? null,
  category: shop.category ?? "",
  tag_id: shop.tag?.id ?? "",
  button_label: shop.button_label ?? "",
});

/** Adds these fields to a product's create or update request. */
export const appendProductSiteFields = (formData: FormData, values: ProductSiteValues) => {
  // Without a slug the API keeps the product's own (or makes one from the title for a new product).
  if (values.slug?.trim()) formData.append("slug", values.slug.trim());
  formData.append("description", values.description ?? "");
  // "" clears the owner or brand.
  formData.append("owner_id", values.owner_id ? String(values.owner_id) : "");
  formData.append("brand_id", values.brand_id ? String(values.brand_id) : "");
  formData.append("is_featured", values.is_featured ? "true" : "false");
  if (values.featured_order !== undefined && values.featured_order !== null) {
    formData.append("featured_order", String(values.featured_order));
  }
  // "" clears the category, the tag or the label. A category saved before the list is left out, so it stays as it is:
  // the API takes only the eight.
  const category = values.category ?? "";
  if (!category || isProductCategory(category)) formData.append("category", category);
  formData.append("tag_id", values.tag_id ? String(values.tag_id) : "");
  formData.append("button_label", values.button_label?.trim() ?? "");
};

type TagOption = { value: number | ""; label: string; editorial: boolean };

/** Every tag, for the Tag select. */
const useProductTags = () => {
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    GetProductTags()
      .then((res) => {
        if (current) setTags(Array.isArray(res.data.data) ? res.data.data : []);
      })
      .catch((err) => {
        console.error("Error loading the product tags:", err);
        if (current) message.error("Couldn't load the product tags");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);
  return { tags, loading };
};

/** A choice of the Tag select: the tag's name, marked when it's editorial. */
const TagChoice = ({ option }: { option: TagOption }) => (
  <Space size={6}>
    <span>{option.label}</span>
    {option.editorial && <Tag color="magenta">Editorial</Tag>}
  </Space>
);

interface ProductSiteFieldsProps {
  isNew: boolean;
  /** The product as loaded, when editing: a category from before the list, or a tag the list lacks, still shows. */
  product?: Shop | null;
}

/**
 * The website's side of a product: its address, its page's text, its category, tag and button, whose page it shows on,
 * and the home page row.
 */
const ProductSiteFields = ({ isNew, product }: ProductSiteFieldsProps) => {
  const slug = Form.useWatch<string | undefined>("slug");
  const { tags, loading: loadingTags } = useProductTags();

  const oldCategory = product?.category && !isProductCategory(product.category) ? product.category : null;
  const categoryOptions = [
    { value: "", label: "No category" },
    ...(oldCategory ? [{ value: oldCategory, label: `${oldCategory} (not in the list)` }] : []),
    ...PRODUCT_CATEGORIES.map((name) => ({ value: name, label: name })),
  ];

  // The product's own tag stays a choice when the list lacks it (the list couldn't be loaded).
  const savedTag = product?.tag;
  const tagChoices: ProductTagRef[] =
    savedTag && !tags.some((tag) => tag.id === savedTag.id) ? [...tags, savedTag] : tags;
  const tagOptions: TagOption[] = [
    { value: "", label: "No tag", editorial: false },
    ...tagChoices.map((tag) => ({ value: tag.id, label: tag.name, editorial: Boolean(tag.is_editorial) })),
  ];

  return (
    <Card title="On the website" size="small" style={{ marginBottom: 24 }}>
      <Form.Item
        name="slug"
        label="Slug"
        extra={
          slug
            ? `The product's address: ${websiteUrl(`/shop/${slug}`)}`
            : isNew
              ? "The product's address. Leave it blank to make one from the title."
              : "The product's address. Leave it blank to keep the current one."
        }
      >
        <Input placeholder="e.g. glow-serum" />
      </Form.Item>

      <Form.Item
        name="description"
        label="Description"
        extra="The product page's longer text; a blank line starts a new paragraph. Without it, the page shows the short description."
      >
        <Input.TextArea rows={5} />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="category"
            label="Category"
            initialValue=""
            extra={
              oldCategory
                ? `“${oldCategory}” was saved before the list of eight; it stays as it is until another is picked.`
                : "Where the shop's category filter lists the product."
            }
          >
            <Select options={categoryOptions} showSearch={{ optionFilterProp: "label" }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="tag_id"
            label="Tag"
            initialValue=""
            extra="Shown top-left on the product's card and page. Only admins can set an editorial tag; owners can set the others on their own products."
          >
            <Select<number | "", TagOption>
              options={tagOptions}
              loading={loadingTags}
              showSearch={{ optionFilterProp: "label" }}
              optionRender={(option) => <TagChoice option={option.data} />}
              labelRender={({ value, label }) => {
                const option = tagOptions.find((choice) => choice.value === value);
                return option ? <TagChoice option={option} /> : label;
              }}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="button_label"
            label="Button label"
            extra="The button on the product page and on the product's cards. Empty: “Shop now”."
            rules={[{ max: BUTTON_LABEL_MAX, message: `At most ${BUTTON_LABEL_MAX} characters` }]}
          >
            <Input placeholder="Shop now" maxLength={BUTTON_LABEL_MAX} showCount />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="owner_id"
            label="Put up by"
            extra="The professional or brand whose page lists this product. Empty: Glamlink's own pick."
          >
            <AccountSelect placeholder="Search professionals and brands" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="brand_id"
            label="Brand page"
            extra="The brand account that makes it; its page lists the product too. The Brand field above is still the name shown."
          >
            <AccountSelect type="brand" placeholder="Search brands" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="is_featured"
            label="Featured on the home page"
            valuePropName="checked"
            initialValue={false}
            extra="The home page's Shop Products row."
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="featured_order"
            label="Order in that row"
            extra="Lowest first."
            rules={[{ type: "integer", message: "A whole number" }]}
          >
            <InputNumber precision={0} placeholder="0" style={{ width: 160 }} />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};

export default ProductSiteFields;
