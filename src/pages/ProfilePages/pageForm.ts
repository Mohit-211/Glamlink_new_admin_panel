import type { FormRule } from "antd";
import { htmlToText } from "../../utils/sanitizeHtml";
import type { PageType, PageUpdate, PageView, ShippingKey, SocialLink } from "../../types/profile";

// The checks the API makes on a page's fields (backend website/profiles/pageFields.js), so the form says so before
// saving. The API still has the last word: a refusal is 400 INVALID_PAGE with `details.field`.

export const LIMITS = {
  name: 150,
  tagline: 150,
  intro: 300,
  category: 60,
  about: 2000,
  link: 500,
  socialTitle: 30,
  social: 10,
  slugMax: 60,
} as const;

/** A brand's Quick Info category (backend website/profiles/quickInfo.js): the key saved, and how the page shows it. */
export const BRAND_CATEGORIES: { value: string; label: string }[] = [
  { value: "skincare", label: "Skincare Brand" },
  { value: "haircare", label: "Haircare Brand" },
  { value: "makeup", label: "Makeup Brand" },
  { value: "nails", label: "Nails Brand" },
  { value: "body", label: "Body & Bath Brand" },
  { value: "fragrance", label: "Fragrance Brand" },
  { value: "wellness", label: "Wellness & Supplements Brand" },
  { value: "devices", label: "Devices & Tools Brand" },
];

export const SHIPPING_OPTIONS: { value: ShippingKey; label: string }[] = [
  { value: "local", label: "Local pickup or delivery" },
  { value: "nationwide", label: "Ships nationwide" },
  { value: "international", label: "Ships internationally" },
];

/** The "Not set" choice of the Quick Info selects: saved as empty. */
export const NOT_SET = { value: "", label: "Not set" };

/**
 * What the category select offers: a brand picks one of the eight categories, anyone else a specialty by name (at
 * most 60 characters, as the API takes it). A saved value that isn't on the list stays, so saving doesn't lose it.
 */
export const categoryOptions = (type: PageType | null | undefined, specialties: string[], saved: string) => {
  const options =
    type === "brand"
      ? BRAND_CATEGORIES
      : [...new Set(specialties.map((name) => name.trim()))]
          .filter((name) => name && name.length <= LIMITS.category)
          .map((name) => ({ value: name, label: name }));
  const kept = saved && !options.some((option) => option.value === saved) ? [{ value: saved, label: saved }] : [];
  return [NOT_SET, ...kept, ...options];
};

/** The page form's values. Text fields hold "" when empty; images hold the uploaded image's link, or "". */
export interface PageFormValues {
  slug: string;
  is_listed: boolean;
  is_featured: boolean;
  featured_order: number | null;
  tagline: string;
  intro: string;
  about: string;
  website: string;
  social: SocialLink[];
  /** "" for none. */
  category: string;
  shipping: ShippingKey | "";
  image: string;
  cover_image: string;
  about_image: string;
  /** Nov 24: a professional's pin on the directory's map; left out for brands and by an API from before. */
  is_on_map?: boolean;
  /** Nov 24: the sign-in email of a brand page an admin made, while it may be set here; "" for none. */
  email?: string;
}

export const NEW_PAGE_VALUES: PageFormValues = {
  slug: "",
  is_listed: true,
  is_featured: false,
  featured_order: 0,
  tagline: "",
  intro: "",
  about: "",
  website: "",
  social: [],
  category: "",
  shipping: "",
  image: "",
  cover_image: "",
  about_image: "",
};

/** Whether the page screen offers the map switch: a professional's page, on an API that answers it (Nov 24). */
export const hasMapSwitch = ({ page, public: shown }: PageView) => shown.type !== "brand" && typeof page.is_on_map === "boolean";

/**
 * Whether an admin may set the account's sign-in email here (Nov 24): a brand page an admin made, while nobody has
 * signed in and it has no live Access card. The API also refuses a card that isn't live (409 EMAIL_NOT_EDITABLE).
 */
export const canSetEmail = (view: PageView, claimed: boolean | undefined) =>
  view.email !== undefined && view.page.created_by_admin && claimed !== true && !view.public.access_card;

/** The form's values for a saved page. The address is the one the page answers to: its own slug, else its card's handle. */
export const toFormValues = (view: PageView): PageFormValues => {
  const { slug, page } = view;
  return {
    slug: slug ?? "",
    is_listed: page.is_listed,
    is_featured: page.is_featured,
    featured_order: page.featured_order,
    tagline: page.tagline ?? "",
    intro: page.intro ?? "",
    about: page.about ?? "",
    website: page.website ?? "",
    social: page.social ?? [],
    category: page.category ?? "",
    shipping: page.shipping ?? "",
    image: page.image ?? "",
    cover_image: page.cover_image ?? "",
    about_image: page.about_image ?? "",
    ...(hasMapSwitch(view) ? { is_on_map: page.is_on_map } : {}),
    email: view.email ?? "",
  };
};

/**
 * The body for UpdatePage and CreateBrandPage: the form's fields and nothing else. Empty fields go as null, so the
 * page falls back to the card's. An empty social list goes as null too: the API keeps an empty list as "no links",
 * which would hide the card's. The address goes only once changed (the API refuses an empty one, and an unchanged
 * card handle stays the card's rather than becoming the page's own).
 */
export const toPageUpdate = (values: PageFormValues, savedSlug: string): PageUpdate => {
  const slug = values.slug.trim();
  const text = (value: string) => value.trim() || null;
  return {
    ...(slug && slug !== savedSlug ? { slug } : {}),
    is_listed: values.is_listed,
    is_featured: values.is_featured,
    featured_order: values.featured_order ?? 0,
    tagline: text(values.tagline),
    intro: text(values.intro),
    about: htmlToText(values.about).trim() ? values.about : null,
    website: text(values.website),
    social: values.social.length
      ? values.social.map((link) => ({ title: link.title.trim(), url: link.url.trim() }))
      : null,
    category: values.category || null,
    shipping: values.shipping || null,
    image: values.image || null,
    cover_image: values.cover_image || null,
    about_image: values.about_image || null,
    ...(typeof values.is_on_map === "boolean" ? { is_on_map: values.is_on_map } : {}),
  };
};

/**
 * What the public sees where a page field is empty: the card's, the directory listing's or the account's. Only known
 * while the page's own field is empty (the public view then shows the fallback); null otherwise.
 */
export interface PageFallbacks {
  /** Whose fields fill the gaps: "Access card", "directory listing", or null (a brand page with neither). */
  source: string | null;
  /** The address is the card's handle: the page has no slug of its own. */
  addressFromCard: boolean;
  tagline: string | null;
  /** The card bio as plain text (only a card's: a listing's bio isn't used). */
  intro: string | null;
  about: string | null;
  website: string | null;
  social: SocialLink[] | null;
  image: string | null;
  /** The card gallery's cover photo. */
  cover_image: string | null;
  /** The page's first photo in Media & Images, else the card gallery's cover photo. */
  about_image: string | null;
}

export const fallbacksOf = ({ slug, page, public: shown }: PageView): PageFallbacks => ({
  source: shown.access_card ? "Access card" : shown.listing ? "directory listing" : null,
  addressFromCard: !page.slug && Boolean(slug),
  tagline: page.tagline ? null : shown.tagline,
  intro: page.intro ? null : (shown.intro ?? null),
  about: page.about ? null : shown.about,
  website: page.website ? null : shown.website,
  social: page.social ? null : shown.social,
  image: page.image ? null : shown.image,
  cover_image: page.cover_image ? null : shown.cover_image,
  about_image: page.about_image ? null : (shown.about_image ?? null),
});

// The API makes a slug of what it gets ("Kate Sue" is kate-sue); the form asks for one already written that way.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lower case, spaces as dashes, while typing. */
export const normalizeSlug = (value: string | undefined) => (value ?? "").toLowerCase().replace(/\s+/g, "-");

/**
 * The address: checked only once changed (an old card handle may not follow today's rule), and it can't be emptied
 * once the page has one (the API can change an address, not remove it). Whether it's free, only the API knows.
 */
export const slugRules = (savedSlug: string): FormRule[] => [
  {
    validator: async (_, value: string | undefined) => {
      const slug = (value ?? "").trim();
      if (slug === savedSlug) return;
      if (!slug) throw new Error("Every page needs an address");
      if (slug.length < 3 || slug.length > LIMITS.slugMax) throw new Error(`Use 3 to ${LIMITS.slugMax} characters`);
      if (!SLUG.test(slug)) throw new Error("Use lower-case letters and digits, with single dashes between words");
    },
  },
];

/** Why the API would refuse this as a web link, or null. Like the API, "example.com" counts as https://example.com. */
export const webLinkProblem = (value: string): string | null => {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.length > LIMITS.link) return `At most ${LIMITS.link} characters`;
  const link = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(link);
    if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".")) return null;
  } catch {
    // Not a URL at all: refused below.
  }
  return "Enter a web link, like example.com";
};

export const webLinkRule: FormRule = {
  validator: async (_, value: string | undefined) => {
    const problem = webLinkProblem(value ?? "");
    if (problem) throw new Error(problem);
  },
};

/** About: at most 2,000 characters of text (formatting doesn't count). */
export const aboutRule: FormRule = {
  validator: async (_, value: string | undefined) => {
    const length = htmlToText(value).trim().length;
    if (length > LIMITS.about) throw new Error(`At most 2,000 characters (now ${length.toLocaleString("en-US")})`);
  },
};
