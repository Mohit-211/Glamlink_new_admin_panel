// Professional and brand pages (the website's /profiles/:slug): one per professional account that has a live
// Access card, an approved directory listing, or a brand page an admin made. Backend: website/profiles.

export type PageType = "individual" | "brand";

/** A page as the admin list shows it (GET /profiles/admin/list). */
export interface PageRow {
  /** The account's id: every page call takes it. */
  id: number;
  slug: string | null;
  type: PageType | null;
  /** A brand's business name, else the person's. */
  name: string | null;
  image: string | null;
  tagline: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  is_featured: boolean;
  featured_order: number;
  is_listed: boolean;
  /** A brand page an admin made: it shows without a card. */
  created_by_admin: boolean;
  has_live_card: boolean;
  /** The public sees it: it exists and isn't unlisted. */
  visible: boolean;
  /** The account has a password, so its owner can sign in and edit the page. */
  claimed: boolean;
  // Since Nov 24; an API from before leaves them out.
  /** On the directory's map (a professional's pin; owners can't change it). */
  is_on_map?: boolean;
  /** The account's sign-in email; null: none yet (a brand page an admin made without one). */
  email?: string | null;
}

export interface SocialLink {
  title: string;
  url: string;
}

/** How far a page's owner ships (Quick Info, Nov 3). */
export type ShippingKey = "local" | "nationwide" | "international";

/** What is set on the page itself. Empty fields fall back to the card's, the listing's, then the account's. */
export interface PageSettings {
  slug: string | null;
  is_listed: boolean;
  is_featured: boolean;
  featured_order: number;
  created_by_admin: boolean;
  tagline: string | null;
  /** Rich text, cleaned like the card bio. */
  about: string | null;
  image: string | null;
  cover_image: string | null;
  website: string | null;
  /** null: the card's (or listing's) social links show. */
  social: SocialLink[] | null;
  // Since Nov 3 (the owner's design); an API from before leaves them out.
  /** The hero's line, at most 300 characters. Empty: the card bio as plain text. */
  intro?: string | null;
  /** Quick Info: a brand's category key ("skincare"), or a professional's specialty by name. */
  category?: string | null;
  shipping?: ShippingKey | null;
  /** The picture beside About. Empty: the page's first photo, else the card gallery's cover photo. */
  about_image?: string | null;
  /** Nov 24: the professional's pin on the directory's map (true unless an admin took it off). */
  is_on_map?: boolean;
}

/** The page as the public sees it. */
export interface PublicPage {
  id: number;
  slug: string | null;
  type: PageType | null;
  name: string | null;
  image: string | null;
  tagline: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  is_featured: boolean;
  /** The page's cover, else (since Nov 3) the card gallery's cover photo. */
  cover_image: string | null;
  about: string | null;
  website: string | null;
  social: SocialLink[];
  location: { city: string | null; state: string | null } | null;
  specialties: string[];
  email: string | null;
  phone: string | null;
  booking_link: string | null;
  /** The live card behind the page, if any. */
  access_card: { slug: string; url: string } | null;
  /** An approved directory listing behind the page, if any. */
  listing: { id: number } | null;
  topics: { id: number; name: string; slug: string }[];
  // Since Nov 3: what shows where the page's own fields are empty, and the Quick Info box.
  intro?: string | null;
  category?: string | null;
  /** "Skincare Brand", or a professional's specialty as named. */
  category_label?: string | null;
  shipping?: ShippingKey | null;
  shipping_label?: string | null;
  about_image?: string | null;
  quick_info?: { has_education: boolean; on_podcast: boolean; in_journal: boolean };
}

/** One account's page as an admin sees it (GET /profiles/admin/:userId). */
export interface PageView {
  user_id: number;
  slug: string | null;
  // Since Nov 24; an API from before leaves them out.
  /** The account's sign-in email; null: none yet. */
  email?: string | null;
  /** Someone has signed in (the account has a password). */
  claimed?: boolean;
  page: PageSettings;
  visible: boolean;
  /** Why the public can't see it. */
  hidden_because: "no_live_card" | "unlisted" | null;
  public: PublicPage;
}

/**
 * Fields an admin can set on a page; "" or null clears a field. Images are links from POST /journal/upload (since
 * Nov 3 the API also takes them as the files `profile_image`, `images` and `about_image`; the form uploads first and
 * sends links).
 */
export interface PageUpdate {
  slug?: string;
  is_listed?: boolean;
  is_featured?: boolean;
  featured_order?: number;
  tagline?: string | null;
  about?: string | null;
  website?: string | null;
  social?: SocialLink[] | null;
  image?: string | null;
  cover_image?: string | null;
  intro?: string | null;
  /** A brand's: one of the eight keys. A professional's: a specialty's name, at most 60 characters. */
  category?: string | null;
  shipping?: ShippingKey | null;
  about_image?: string | null;
  /** Nov 24: false takes a professional's pin off the directory's map. */
  is_on_map?: boolean;
  /**
   * Nov 24: the sign-in email of a brand page an admin made, while nobody has signed in and it has no Access card;
   * "" clears it. 409 ACCOUNT_EXISTS (another account has it), ALREADY_CLAIMED or EMAIL_NOT_EDITABLE otherwise.
   */
  email?: string;
}

export interface PageListParams {
  search?: string;
  type?: PageType;
  /** Only featured pages, in their order. */
  featured?: boolean;
  /** Nov 24: only the pages on (true) or off (false) the directory's map. */
  on_map?: boolean;
  page?: number;
  /** At most 50. */
  limit?: number;
}

// ---- Brands in bulk from a CSV (Nov 24): POST /profiles/admin/brands/import ----

/**
 * One row's outcome: `created` (`ready` in a dry run) with the new page's `user_id` and `slug`; `skipped` when it is
 * already here (`ACCOUNT_EXISTS`: its email has an account; `BRAND_EXISTS`: a brand of that name; `user_id` is it); or
 * `failed`, to fix and upload again (`INVALID_PAGE` with `field`, `DUPLICATE_IN_FILE`, `INVALID_CSV`).
 */
export interface BrandImportRow {
  /** As the spreadsheet numbers it: the header is row 1. */
  row: number;
  name: string | null;
  email: string | null;
  status: "created" | "ready" | "skipped" | "failed";
  code: string | null;
  field: string | null;
  message: string | null;
  user_id: number | null;
  slug: string | null;
  /** What the brand was (or would be) made without: "website: website must be a web link. (left out)". */
  warnings: string[];
}

export interface BrandImportResult {
  dry_run: boolean;
  total: number;
  created: number;
  ready: number;
  skipped: number;
  failed: number;
  with_warnings: number;
  /** Columns the import doesn't read. */
  ignored_columns: string[];
  rows: BrandImportRow[];
}

/** A page's numbers for a date range (GET /profiles/admin/:userId/analytics), in card analytics' shape. */
export interface PageAnalytics {
  page: { id: number; slug: string | null; name: string | null; visible: boolean };
  date_range: { from: string; to: string };
  summary: { total_views: number; unique_visitors: number; total_clicks: number };
  /**
   * Count per event: PAGE_VIEW, WEBSITE_CLICK, ACCESS_CARD_CLICK, PRODUCT_CLICK, BOOKING_CLICK, SOCIAL_CLICK, EMAIL_CLICK,
   * PHONE_CLICK; since Nov 3 SHARE_CLICK, MEDIA_CLICK, EDUCATION_CLICK, PODCAST_CLICK and JOURNAL_CLICK.
   */
  events: Record<string, number>;
  /** Days with any views (or clicks) only. */
  daily_views: { date: string; count: number }[];
  daily_clicks: { date: string; count: number }[];
  device_breakdown: { device_type: string | null; count: number }[];
  /**
   * The ten most clicked targets (`event_target`: what was clicked; an id for PRODUCT_CLICK, MEDIA_CLICK and
   * JOURNAL_CLICK, a slug for EDUCATION_CLICK and PODCAST_CLICK).
   */
  top_targets: { event_type: string; event_target: string; count: number }[];
}

// ---- A page's own content (Nov 3): Media & Images and Education, as admins edit them on any page ----

/** One photo or video of a page's Media & Images (GET /profiles/admin/:userId/media), hidden ones included. */
export interface PageMediaItem {
  id: number;
  kind: "image" | "video";
  /** An upload here (a card copy too), or a YouTube or Vimeo link. */
  source: "upload" | "youtube" | "vimeo";
  /** The photo, the MP4, or the YouTube or Vimeo watch link. */
  url: string;
  /** A video's poster or the provider's thumbnail; null for a photo (its `url` is the picture). */
  thumbnail: string | null;
  embed_url: string | null;
  caption: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  /** Hidden by an admin: kept, but not on the page. */
  is_hidden: boolean;
  sort_order: number;
  /** Copied from the Access card's gallery (deleting it leaves the card's file alone). */
  from_card: boolean;
  created_at: string;
}

/** What an admin changes on one item (PUT .../media/:id); "" clears a caption or alt text. */
export interface PageMediaUpdate {
  caption?: string;
  alt?: string;
  is_hidden?: boolean;
}

export interface EducationVideo {
  source: "upload" | "youtube" | "vimeo";
  url: string;
  embed_url: string | null;
  thumbnail: string | null;
  duration_seconds: number | null;
}

/** One Education post (GET /profiles/admin/:userId/education), drafts included; `body` only when one is asked for. */
export interface PageEducationItem {
  id: number;
  /** Its address under the page: /profiles/<page>/education/<slug>. */
  slug: string;
  kind: "video" | "article";
  title: string;
  summary: string | null;
  /** Its own cover, else (a video's) the video's thumbnail. */
  cover_image: string | null;
  video: EducationVideo | null;
  published_at: string | null;
  status: "draft" | "published";
  sort_order: number;
  created_at: string;
  updated_at: string;
  /** The article's HTML, as the API cleaned it. */
  body?: string | null;
}

/** An article that features the page (GET /profiles/:slug/articles), as the website lists it. */
export interface TaggedArticle {
  id: number;
  slug: string | null;
  title: string;
  short_description: string | null;
  cover_image: string | null;
  publish_date: string | null;
  is_featured: boolean;
  created_at: string;
  journal_author?: { id: number; name: string | null } | null;
  journal_category?: { id: number; title: string; slug: string } | null;
}

/** A video the page's account appears in (GET /profiles/:slug/videos), as the website lists it. */
export interface TaggedVideo {
  id: number;
  slug: string;
  title: string;
  youtube_id: string | null;
  thumbnail: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  is_featured: boolean;
  series: { id: number; name: string; slug: string } | null;
}
