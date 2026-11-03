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
}

export interface PageListParams {
  search?: string;
  type?: PageType;
  /** Only featured pages, in their order. */
  featured?: boolean;
  page?: number;
  /** At most 50. */
  limit?: number;
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
