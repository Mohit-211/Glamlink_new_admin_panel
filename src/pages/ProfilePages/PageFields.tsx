import React, { useEffect, useState } from "react";
import { Button, Form, Image, Input, InputNumber, Select, Switch } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import ImageUploadField from "../../components/ImageUploadField";
import RichTextEditor from "../../components/RichTextEditor";
import SafeHtml from "../../components/SafeHtml";
import { GetSpecialities } from "../../services/Api/SpecialitiesApi";
import { htmlToText } from "../../utils/sanitizeHtml";
import type { PageType } from "../../types/profile";
import {
  LIMITS,
  NOT_SET,
  SHIPPING_OPTIONS,
  aboutRule,
  categoryOptions,
  normalizeSlug,
  slugRules,
  webLinkRule,
  type PageFallbacks,
  type PageFormValues,
} from "./pageForm";
import { publicPageUrl, shortUrl } from "./pageStatus";
import styles from "./ProfilePages.module.scss";

interface PageFieldsProps {
  /** What the page shows where a field is empty; null for a new brand page (nothing behind it yet). */
  fallbacks: PageFallbacks | null;
  /** The address saved now, "" for none: it is checked only once changed. */
  savedSlug: string;
  /** The account's type: a brand's category comes from the brand list, anyone else's from the specialties. */
  type: PageType | null;
  /** A new brand page: an empty address is made from the name. */
  creating?: boolean;
}

/** What a fallback looks like now, under its field. */
const Fallback = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.fallback}>
    <span className={styles.fallbackLabel}>Showing now</span>
    {children}
  </div>
);

/** The specialties a professional's category is picked from (GET /profession, as the card screens load them). */
const useSpecialties = (wanted: boolean) => {
  const [state, setState] = useState<{ names: string[] | null; failed: boolean }>({ names: null, failed: false });
  useEffect(() => {
    if (!wanted) return;
    let current = true;
    GetSpecialities({ page: 1, limit: 1000, sortBy: "asc" })
      .then((body) => {
        const rows = Array.isArray(body?.data?.rows) ? body.data.rows : [];
        if (current) setState({ names: rows.map((row) => String(row?.title ?? "")), failed: false });
      })
      .catch(() => {
        if (current) setState({ names: [], failed: true });
      });
    return () => {
      current = false;
    };
  }, [wanted]);
  return state;
};

/**
 * The fields an admin sets on a page (PUT /profiles/admin/:userId), shared by the page screen and "New brand page".
 * Goes inside a Form whose values are PageFormValues.
 */
const PageFields = ({ fallbacks, savedSlug, type, creating = false }: PageFieldsProps) => {
  const form = Form.useFormInstance<PageFormValues>();
  const featured = Form.useWatch("is_featured", form);
  const about = Form.useWatch("about", form) ?? "";
  const image = Form.useWatch("image", form) ?? "";
  const cover = Form.useWatch("cover_image", form) ?? "";
  const aboutImage = Form.useWatch("about_image", form) ?? "";
  const category = Form.useWatch("category", form) ?? "";
  const brand = type === "brand";
  const specialties = useSpecialties(!brand);

  const source = fallbacks?.source;
  const fromCard = source === "Access card";
  const whenEmpty = (what: string) => (source ? ` Empty: the ${source}'s ${what} shows.` : "");

  const slugHint = creating
    ? "Empty: made from the name."
    : fallbacks?.addressFromCard
      ? "Now the Access card's handle: change it to give the page an address of its own."
      : "";

  const socialHint = (count: number) => {
    if (count) return source ? `Up to ${LIMITS.social}. They replace the ${source}'s links.` : `Up to ${LIMITS.social}.`;
    if (!source) return "None.";
    const shown = fallbacks?.social;
    if (!shown) return `None of its own: the ${source}'s links show.`;
    return shown.length
      ? `None of its own: the ${source}'s links show (${shown.map((link) => link.title).join(", ")}).`
      : `None of its own: the ${source}'s links show, and it has none.`;
  };

  const loadingSpecialties = !brand && specialties.names === null;
  const categoryHint = brand
    ? "What kind of brand it is, shown as “Skincare Brand” in Quick Info and under the name."
    : specialties.failed
      ? "The specialties couldn't be loaded: try again later. The saved category stays."
      : "The main specialty, from the specialties list. Shown in Quick Info and under the name.";

  return (
    <>
      <h4 className={styles.sectionTitle}>Address and visibility</h4>
      <Form.Item
        name="slug"
        label="Address"
        normalize={normalizeSlug}
        rules={slugRules(savedSlug)}
        extra={[
          `The page's address on the website: 3 to ${LIMITS.slugMax} lower-case letters, digits and dashes, not used by any other page or card.`,
          slugHint,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Input prefix={shortUrl(publicPageUrl(""))} maxLength={LIMITS.slugMax} />
      </Form.Item>
      <Form.Item
        name="is_listed"
        label="Listed on the website"
        valuePropName="checked"
        extra="Off: the page is hidden everywhere on the website, even with a live Access card."
      >
        <Switch />
      </Form.Item>
      <div className={styles.inlineFields}>
        <Form.Item
          name="is_featured"
          label="Featured"
          valuePropName="checked"
          extra="Featured pages show in the home page's rows."
        >
          <Switch />
        </Form.Item>
        <Form.Item name="featured_order" label="Featured order" extra="Lowest first, then by name.">
          <InputNumber min={0} precision={0} disabled={!featured} />
        </Form.Item>
      </div>

      <h4 className={styles.sectionTitle}>What the page shows</h4>
      <Form.Item
        name="tagline"
        label="Tagline"
        extra={`A line under the name.${whenEmpty("title")}`}
      >
        <Input maxLength={LIMITS.tagline} showCount placeholder={fallbacks?.tagline ?? undefined} />
      </Form.Item>
      <Form.Item
        name="intro"
        label="Intro"
        extra={`A few words over the cover, under the name; at most ${LIMITS.intro} characters.${
          fromCard ? " Empty: the start of the Access card's bio shows." : ""
        }`}
      >
        <Input.TextArea
          maxLength={LIMITS.intro}
          showCount
          autoSize={{ minRows: 2, maxRows: 6 }}
          placeholder={fallbacks?.intro ?? undefined}
        />
      </Form.Item>
      <Form.Item
        name="about"
        label="About"
        rules={[aboutRule]}
        extra={
          <>
            {`The website's formatting only, at most 2,000 characters.${whenEmpty("bio")}`}
            {fallbacks?.about && !htmlToText(about).trim() && (
              <Fallback>
                <SafeHtml html={fallbacks.about} />
              </Fallback>
            )}
          </>
        }
      >
        <RichTextEditor simple maxLength={LIMITS.about} height={160} />
      </Form.Item>
      <Form.Item
        name="website"
        label="Website"
        rules={[webLinkRule]}
        extra={`A link like example.com (https:// is added).${whenEmpty("website")}`}
      >
        <Input maxLength={LIMITS.link} placeholder={fallbacks?.website ?? "example.com"} />
      </Form.Item>
      <Form.Item label="Social links">
        <Form.List name="social">
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map(({ key, name }) => (
                <div key={key} className={styles.socialRow}>
                  <Form.Item
                    name={[name, "title"]}
                    rules={[{ required: true, whitespace: true, message: "Name the link" }]}
                  >
                    <Input maxLength={LIMITS.socialTitle} placeholder="Instagram" aria-label="Link name" />
                  </Form.Item>
                  <Form.Item
                    name={[name, "url"]}
                    rules={[{ required: true, whitespace: true, message: "Enter the link" }, webLinkRule]}
                  >
                    <Input maxLength={LIMITS.link} placeholder="instagram.com/…" aria-label="Link" />
                  </Form.Item>
                  <Button icon={<DeleteOutlined />} aria-label="Remove link" onClick={() => remove(name)} />
                </div>
              ))}
              <Button
                icon={<PlusOutlined />}
                onClick={() => add({ title: "", url: "" })}
                disabled={fields.length >= LIMITS.social}
              >
                Add link
              </Button>
              <Form.ErrorList errors={errors} />
              <div className={styles.hint}>{socialHint(fields.length)}</div>
            </>
          )}
        </Form.List>
      </Form.Item>

      <h4 className={styles.sectionTitle}>Quick Info</h4>
      <p className={styles.sectionNote}>
        Lines in the Quick Info box on the page. The others (education, The Beauty Vault, the Journal) come from what
        the page has.
      </p>
      <div className={styles.twoColumns}>
        <Form.Item name="category" label="Category" extra={categoryHint}>
          <Select
            options={categoryOptions(type, specialties.names ?? [], category)}
            loading={loadingSpecialties}
            showSearch={{ optionFilterProp: "label" }}
            placeholder={NOT_SET.label}
          />
        </Form.Item>
        <Form.Item name="shipping" label="Shipping" extra="Whether and how far it ships.">
          <Select options={[NOT_SET, ...SHIPPING_OPTIONS]} />
        </Form.Item>
      </div>

      <h4 className={styles.sectionTitle}>Images</h4>
      <div className={styles.twoColumns}>
        <Form.Item
          name="image"
          label="Image"
          extra={
            <>
              {`A logo or photo, cropped square.${whenEmpty("photo")}`}
              {fallbacks?.image && !image && (
                <Fallback>
                  <Image src={fallbacks.image} width={72} height={72} alt="" className={styles.fallbackImage} />
                </Fallback>
              )}
            </>
          }
        >
          <ImageUploadField aspect={1} previewWidth={120} />
        </Form.Item>
        <Form.Item
          name="cover_image"
          label="Cover image"
          extra={
            <>
              {`A wide picture across the top of the page, cropped 3:1. Empty: ${
                fromCard ? "the Access card's cover photo, if it has one." : "no cover."
              }`}
              {fallbacks?.cover_image && !cover && (
                <Fallback>
                  <Image src={fallbacks.cover_image} width={180} height={60} alt="" className={styles.fallbackImage} />
                </Fallback>
              )}
            </>
          }
        >
          <ImageUploadField aspect={3} previewWidth={300} />
        </Form.Item>
        <Form.Item
          name="about_image"
          label="About image"
          extra={
            <>
              {`Beside the About text, cropped 4:3. Empty: the page's first photo in Media & Images${
                fromCard ? ", else the Access card's cover photo" : ""
              }.`}
              {fallbacks?.about_image && !aboutImage && (
                <Fallback>
                  <Image src={fallbacks.about_image} width={96} height={72} alt="" className={styles.fallbackImage} />
                </Fallback>
              )}
            </>
          }
        >
          <ImageUploadField aspect={4 / 3} previewWidth={200} />
        </Form.Item>
      </div>
    </>
  );
};

export default PageFields;
