/**
 * Every screen's address, grouped as the sidebar groups them. The routes (App.tsx), the sidebar (MainLayout) and the
 * links between screens all read these, so an address is changed here and nowhere else.
 *
 * One pattern throughout: a sidebar group's screens sit under the group's prefix (/journal/…, /shop/…), and a list's
 * own pages under the list: `…/new` to add, `…/:id` to open one, `…/:id/edit` where opening and editing are separate
 * screens. The sidebar selects a list's entry on every page under it.
 *
 * Builders take an id, or a route parameter (":id") where App.tsx declares the route.
 */

type Id = number | string;

export const paths = {
  dashboard: "/",

  // Professionals: their accounts and everything that belongs to one.
  professionals: "/professionals",
  professional: (id: Id) => `/professionals/${id}`,
  profilePages: "/professionals/pages",
  newBrandPage: "/professionals/pages/new",
  importBrands: "/professionals/pages/import",
  profilePage: (userId: Id) => `/professionals/pages/${userId}`,
  profilePageAnalytics: (userId: Id) => `/professionals/pages/${userId}/analytics`,
  subscriptions: "/professionals/subscriptions",
  applicantForms: "/professionals/applicant-forms",
  specialities: "/professionals/specialities",
  newSpeciality: "/professionals/specialities/new",
  speciality: (id: Id) => `/professionals/specialities/${id}`,
  loginActivity: "/professionals/login-activity",

  // Access cards: the cards, their keychain orders, what they cost, how they are used.
  cards: "/access/cards",
  newCard: "/access/cards/new",
  card: (id: Id) => `/access/cards/${id}`,
  orders: "/access/orders",
  order: (id: Id) => `/access/orders/${id}`,
  pricing: "/access/pricing",
  cardAnalytics: "/access/analytics",

  // Directory
  directoryApplications: "/directory/applications",
  newDirectoryListing: "/directory/applications/new",
  directoryApplication: (id: Id) => `/directory/applications/${id}`,
  editDirectoryListing: (id: Id) => `/directory/applications/${id}/edit`,
  listingClaims: "/directory/claims",
  directorySections: "/directory/sections",

  // Inquiries: what the website's forms collect.
  partnerInquiries: "/inquiries/partners",
  partnerInquiry: (id: Id) => `/inquiries/partners/${id}`,
  featureRequests: "/inquiries/feature-requests",
  newsletter: "/inquiries/newsletter",

  // Journal
  articles: "/journal/articles",
  newArticle: "/journal/articles/new",
  article: (id: Id) => `/journal/articles/${id}`,
  journalCategories: "/journal/categories",
  authors: "/journal/authors",
  journalFaqs: "/journal/faqs",

  // Topics: shared by articles, products, podcast guests and videos, with their own pages on the website.
  topics: "/topics",
  newTopic: "/topics/new",
  topic: (id: Id) => `/topics/${id}`,
  editTopic: (id: Id) => `/topics/${id}/edit`,

  // Shop
  products: "/shop/products",
  newProduct: "/shop/products/new",
  product: (id: Id) => `/shop/products/${id}`,
  productTags: "/shop/tags",

  // Media
  magazine: "/media/magazine",
  newIssue: "/media/magazine/new",
  issue: (id: Id) => `/media/magazine/${id}`,
  videos: "/media/videos",
  video: (id: Id) => `/media/videos/${id}`,
  videoSeries: "/media/series",
  podcastSchedule: "/media/podcast-schedule",
  newPodcastScheduleItem: "/media/podcast-schedule/new",
  podcastScheduleItem: (id: Id) => `/media/podcast-schedule/${id}`,

  // Discover: education and events (no website page shows them today).
  education: "/discover/education",
  newEducationItem: "/discover/education/new",
  educationItem: (id: Id) => `/discover/education/${id}`,
  events: "/discover/events",
  newEvent: "/discover/events/new",
  event: (id: Id) => `/discover/events/${id}`,

  // Ads
  ads: "/ads",
  newAd: "/ads/new",
  ad: (id: Id) => `/ads/${id}`,
  editAd: (id: Id) => `/ads/${id}/edit`,

  // Website: its home page and what visitors search for.
  homePage: "/website/home-page",
  searchTerms: "/website/search-terms",

  // The panel's admins, and the signed-in admin's own account (the header's menu).
  admins: "/admins",
  newAdmin: "/admins/new",
  account: "/account",
  changePassword: "/account/password",

  login: "/login",
  /** Shown when the API refuses an admin (403). */
  forbidden: "/error401",
} as const;

/**
 * The addresses used until Nov 22, 2026, each with the one it moved to. They redirect, so bookmarks and old links keep
 * working, with their query string. Keep `/access-orders/:id`: the backend's order email links to it
 * (`src/website/access-card/payments.js`). A parameter keeps its name on both sides.
 */
export const MOVED_PATHS: readonly (readonly [from: string, to: string])[] = [
  ["/viewProfessionals/:id", paths.professional(":id")],
  ["/pages", paths.profilePages],
  ["/pages/new", paths.newBrandPage],
  ["/pages/:userId", paths.profilePage(":userId")],
  ["/pages/:userId/analytics", paths.profilePageAnalytics(":userId")],
  ["/access-subscriptions", paths.subscriptions],
  ["/form", paths.applicantForms],
  ["/specialities", paths.specialities],
  ["/add-specialities", paths.newSpeciality],
  ["/edit-specialities/:id", paths.speciality(":id")],
  ["/loginLogs", paths.loginActivity],

  ["/digital-card", paths.cards],
  ["/addBusinessCard", paths.newCard],
  ["/editBusinessCard/:id", paths.card(":id")],
  ["/access-orders", paths.orders],
  ["/access-orders/:id", paths.order(":id")],
  ["/access-pricing", paths.pricing],
  ["/access-analytics", paths.cardAnalytics],

  ["/directory-applications", paths.directoryApplications],
  ["/directory-applications/add", paths.newDirectoryListing],
  ["/directory-applications/:id", paths.directoryApplication(":id")],
  ["/directory-applications/edit/:id", paths.editDirectoryListing(":id")],
  ["/directory-claims", paths.listingClaims],
  ["/directory", paths.directorySections],

  ["/partner-inquiries", paths.partnerInquiries],
  ["/view-partner-inquiry/:id", paths.partnerInquiry(":id")],
  ["/feature-requests", paths.featureRequests],
  ["/newsletter", paths.newsletter],

  ["/journals", paths.articles],
  ["/add-journal", paths.newArticle],
  ["/edit-journal/:id", paths.article(":id")],
  ["/journal-categories", paths.journalCategories],
  ["/authors", paths.authors],
  ["/journal-faqs", paths.journalFaqs],

  ["/journal-topics", paths.topics],
  ["/journal-topics/add", paths.newTopic],
  ["/journal-topics/:id", paths.topic(":id")],
  ["/journal-topics/edit/:id", paths.editTopic(":id")],

  ["/shop", paths.products],
  ["/add-shop", paths.newProduct],
  ["/edit-shop/:id", paths.product(":id")],

  ["/magazine", paths.magazine],
  ["/magazine/add", paths.newIssue],
  ["/magazine/edit/:id", paths.issue(":id")],
  ["/watch/videos", paths.videos],
  ["/watch/videos/:id", paths.video(":id")],
  ["/watch/series", paths.videoSeries],
  ["/podcast-schedule", paths.podcastSchedule],
  ["/add-podcast-schedule", paths.newPodcastScheduleItem],
  ["/edit-podcast-schedule/:id", paths.podcastScheduleItem(":id")],

  ["/education", paths.education],
  ["/add-education", paths.newEducationItem],
  ["/edit-education/:id", paths.educationItem(":id")],
  ["/events", paths.events],
  ["/add-event", paths.newEvent],
  ["/edit-event/:id", paths.event(":id")],

  ["/add-ad", paths.newAd],
  ["/view-ad/:id", paths.ad(":id")],
  ["/edit-ad/:id", paths.editAd(":id")],

  ["/home-page", paths.homePage],
  ["/search-terms", paths.searchTerms],

  ["/adminList", paths.admins],
  ["/addAdmin", paths.newAdmin],
  ["/viewAdmin", paths.account],
  ["/reset-password", paths.changePassword],
];
