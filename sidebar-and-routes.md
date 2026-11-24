# Sidebar and addresses: what changed (Nov 22, 2026)

The sidebar is regrouped so each screen sits with what it belongs to, and every screen has an address in one consistent
pattern. Old addresses still work: they redirect. On `main` since Nov 24, in one commit with the screens of the
backend's Nov 24 handoff.

## What was wrong

- **Topics** were under Journals, but a topic links articles, shop products, podcast guests, videos and professionals,
  and has its own pages on the website (`/topics`) and tiles on the home page.
- **Subscriptions** were under Access Cards, but an Access Pro seat belongs to a person (one per account, kept when the
  card is deleted), and the Professionals list didn't say who had one.
- **Journals** held nine screens, five of them not the Journal's: Shop, Product Tags, Education, Events and Topics. Its
  list was also called "Journals", like the group.
- **The directory's three screens were scattered:** Directory Applications and Listing Claims at the top, Directory
  Sections further down.
- **Loose top-level entries:** Profile Pages, Applicant Form and Specialities (all about professionals); "Access
  Management", the panel's admins, which read like Access cards.
- **The account menu** (top right) held User Login Activity, which lists every account's sign-ins, not the signed-in
  admin's.
- **Addresses in four styles** (`/viewProfessionals/12`, `/edit-journal/12`, `/journal-topics/edit/12`,
  `/magazine/edit/12`), several named after old features (`/digital-card`, `/form`, `/adminList`), and 20 add, edit and
  view pages outside their list's address, so the sidebar highlighted nothing on them (Oct 30 audit, X-13).
- **No "page not found":** a mistyped or removed address showed an empty page (audit X-04).

## The new sidebar

```
Dashboard
Professionals ▸   All Professionals · Profile Pages · Subscriptions · Applicant Forms (badge) · Specialities · Login Activity
Access Cards ▸    Cards · Orders · Pricing · Analytics
Directory ▸       Applications (badge) · Listing Claims (badge) · Sections
Inquiries ▸       Partner With Us · Feature Requests · Newsletter
Journal ▸         Articles · Categories · Authors · FAQs
Topics
Shop ▸            Products · Product Tags
Media ▸           Magazine · Videos · Video Series · Podcast Schedule
Discover ▸        Education · Events
Ads
Website ▸         Home Page · Search Terms
Admins
```

13 top-level entries (15 before). The order runs from people and money (professionals, their cards, the directory,
what the website's forms collect) to content (Journal, Topics, Shop, Media, Discover), then the website and the admins.

## What moved

| Screen | Before | Now | Why |
| --- | --- | --- | --- |
| Professionals list | top level, "Professionals" | Professionals ▸ All Professionals | The group holds everything about a professional |
| Profile pages | top level | Professionals ▸ Profile Pages | A professional's or brand's public page |
| Subscriptions | Access Cards ▸ Subscriptions | Professionals ▸ Subscriptions | A seat is a person's; the list now shows it too (below) |
| Applicant forms | top level, "Applicant Form" | Professionals ▸ Applicant Forms | Forms professionals sent |
| Specialities | top level, near the bottom | Professionals ▸ Specialities | The professions professionals pick |
| Login activity | account menu, "User Login Activity" | Professionals ▸ Login Activity | Website accounts' sign-ins, not the admin's own |
| Card requests | Access Cards ▸ Card Requests | Access Cards ▸ Cards | It lists every card (live ones and guest drafts too), not just requests |
| Access orders | Access Cards ▸ Access Orders | Access Cards ▸ Orders | Shorter inside its group |
| Directory applications | top level | Directory ▸ Applications | The directory's screens together |
| Listing claims | top level | Directory ▸ Listing Claims | " |
| Directory sections | top level, "Directory Sections" | Directory ▸ Sections | " |
| Articles | Journals ▸ Journals | Journal ▸ Articles | The group and its list no longer share a name |
| Topics | Journals ▸ Topics | top level, "Topics" | Shared by all content, with its own website pages |
| Shop products | Journals ▸ Shop | Shop ▸ Products | The shop is its own section of the website |
| Product tags | Journals ▸ Product Tags | Shop ▸ Product Tags | Tags belong to products |
| Education, Events | Journals ▸ Education, Events | Discover ▸ Education, Events | "Discover" lists in the API, not Journal content. No website page shows them today (backend handoff, 8.3) |
| Admins | top level, "Access Management" | top level, "Admins" | Not to be confused with Access cards |

In the same place as before: Dashboard, the three Inquiries, Pricing and Analytics, the Journal's Categories, Authors
and FAQs, the four Media screens, Ads, and the two Website screens.

## Addresses

- **One pattern.** A group's screens sit under its prefix (`/professionals/…`, `/access/…`, `/directory/…`,
  `/inquiries/…`, `/journal/…`, `/shop/…`, `/media/…`, `/discover/…`, `/website/…`), and a list's pages under the list:
  `…/new` to add, `…/12` to open one, `…/12/edit` where opening and editing are different screens (directory
  applications, topics, ads). Examples: `/journal/articles/12`, `/topics/4/edit`, `/professionals/pages/812/analytics`.
- **Every add, edit and detail page highlights its list in the sidebar**, and its group opens (audit X-13).
- **All 65 old addresses redirect** to the new ones, keeping any `?query` and `#hash`. The full list is at the end.
- **The order email keeps working.** The backend's admin email links to `/access-orders/:id`
  (`src/website/access-card/payments.js`); it now redirects to `/access/orders/:id`. Keep that redirect.
- **An unknown address** shows "Page not found" with a button to the dashboard.
- **The signed-in admin's own pages** moved to `/account` (View Profile) and `/account/password` (Change Password).

## Other changes

- **One group open at a time.** Opening a group closes the others, and the current page's group opens by itself. Before,
  every group opened by hand stayed open.
- **Badges stay in sight.** A closed group shows its entries' counts added up: Professionals shows the applicant forms
  to review, Directory the applications and claims.
- **The account menu** holds only the admin's own account: View Profile, Change Password, Sign Out.
- **Professionals list: a new "Access Pro" column.** For each professional: the seat's status (Active, Trial, Past due,
  Canceled…, in the same words and colours as Subscriptions) and how it's paid (Stripe or Complimentary), or "None".
  It costs one extra request when the list opens (`GET /access/admin/subscriptions`). If that request fails, the column
  shows "—" and the list still loads. The API answers the latest 1,000 seats; a live seat changes at every renewal, so
  live ones are always in it.
- **Page titles match the sidebar.** Each list's title is its sidebar name, and its add and edit pages use the same noun.
  See [Page titles](#page-titles) below.
- **Login Activity's Role column.** Professionals showed as "Driver" and brands as nothing. Now: App user, Professional,
  Brand.
- **Sidebar counts.** A count the API doesn't answer as a number shows no badge. Before, only `NaN` was caught.

## Page titles

Each list's title is now its sidebar name, in the sidebar's capitals:

| Sidebar | Title before |
| --- | --- |
| Professionals ▸ All Professionals | Professionals Management |
| Professionals ▸ Profile Pages | Professional and brand pages |
| Professionals ▸ Subscriptions | Access Subscriptions |
| Professionals ▸ Applicant Forms | Professional Form |
| Professionals ▸ Specialities | SPECIALITIES |
| Professionals ▸ Login Activity | User Login Activity: |
| Access Cards ▸ Cards | Digital Business Cards (the drafts view keeps "Guest Drafts") |
| Access Cards ▸ Orders | Access Orders |
| Access Cards ▸ Pricing | Access Pricing |
| Access Cards ▸ Analytics | Access Card Analytics |
| Directory ▸ Applications | Directory applications |
| Directory ▸ Listing Claims | Listing claims |
| Directory ▸ Sections | DIRECTORY MANAGEMENT |
| Journal ▸ Articles | Journals |
| Journal ▸ Categories | JOURNAL CATEGORY |
| Journal ▸ Authors | AUTHORS |
| Journal ▸ FAQs | Journal FAQs |
| Topics | Journal Topics |
| Shop ▸ Products | Shop |
| Shop ▸ Product Tags | Product tags |
| Media ▸ Video Series | Video series |
| Media ▸ Podcast Schedule | PODCAST SCHEDULES |
| Discover ▸ Education | EDUCATION |
| Discover ▸ Events | Event |
| Admins | Admin List |

Dashboard, Partner With Us, Feature Requests, Newsletter, Magazine, Videos, Ads, Home Page and Search Terms already
matched.

The add and edit pages and the list's own labels use the same words:

- **Articles:** "Add Article", "Edit Article", "Return to Articles", "Article details", "Publish article", "Update
  article", and the list's tooltips, delete dialog and messages. The article's "Shops" field is "Products". "Journal"
  stays where it means the website's Journal section ("Featured (Journal hero)", "Journal listings").
- **Products:** "Add Product", "Edit Product", "Return to Products", "Publish Product", "Update Product", "Bulk Import
  Products", and the list's delete dialog and messages. A topic's page lists its "Products" (was "Shops").
- **Cards:** "Create Access Card" and "Update Access Card" buttons (were "… Business Card"), "Search cards", the row
  tooltips, the delete dialog and messages, and the QR code window. The edit page's subtitle was a cut-off sentence.
- **Specialities:** "Add Speciality", "Edit Speciality". **Education and Events:** each page's heading is "Education" or
  "Events", and the back buttons say "Return to Education" or "Return to Events".
- **Home Page:** its note now says the home page's tiles are "topics" (was "journal topics"), and links to Products,
  under Shop.

## Testing against the live API

Checked on Nov 22: the live API (api.glamlink.net) answers a browser on `http://localhost:3000`, and refused `localhost:3001`
(403). From headless Chrome on `localhost:3000`, a public read answered 200, and an admin read with a made-up token a
plain 401, so a real sign-in will work.

- **On the server: nothing, for the panel to reach the API.** `ACCESSDOMAINS` already lists `http://localhost:3000`.
- **On the server: make sure it runs the backend's `master`.** The panel's buy-label screens need its Nov 16 code
  (`4aa47dc`), and the topic, brand-import, email and map screens its Nov 24 code (`e6e95a3`, live since Nov 24).
- **Locally:** `cp .env.example .env`, put in the Maps key, then `npm run dev`. The dev server now stays on port 3000
  (`strictPort`): before, it moved to 3001 when 3000 was busy, and the API refused it.
- **Mind the data.** Since Nov 5 the API is live: buying a label pays Shippo, cancelling an order or a subscription
  is real, approving a listing or sending a claim email emails a real person.

## For developers

| File | What it holds |
| --- | --- |
| `src/paths.ts` | Every screen's address (`paths.article(12)`, `paths.topics`…), and `MOVED_PATHS`: old address → new |
| `src/components/sidebarMenu.tsx` | The sidebar's groups and entries as data; `screenFor(address)` picks the entry to highlight |
| `src/App.tsx` | Routes built from `paths`, the redirects, and the "Page not found" route |
| `src/components/MainLayout.tsx` | Draws the sidebar from that data: one group open, group badges, the account menu |
| `src/pages/AccessSubscriptions/seats.ts` | Seat statuses and sources, shared by Subscriptions and the Professionals list |

No screen hard-codes an address any more: every link, `navigate()` and back button uses `paths`.

- **To add a screen:** add its address to `paths.ts`, its route to `App.tsx`, and its entry to `sidebarMenu.tsx`. Link to
  it with `paths.…`.
- **To move a screen:** change its address in `paths.ts`, and add the old one to `MOVED_PATHS`.
- **Tests guard this:**
  - `sidebarMenu.test.ts` checks where each screen sits, which entry each address highlights, and that every moved
    address lands on a screen with its parameters intact.
  - `App.test.tsx` opens every sidebar entry, follows the redirects (the order email's included), and checks the
    badges, the one-open group, the account menu and "Page not found".
  - `Professionals.test.tsx` covers the Access Pro column.

## Checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors; the same 16 warnings as before, all in older files |
| `npm test` | 329 tests in 50 files pass (270 in 48 before). In 1 of 6 full runs, one test unrelated to routing failed (the profile page's claim-email confirmation); it passes on its own and in the other runs |
| Production build | Passes: 3.01 MB (921 KB gzipped) in one file, as before (built to a scratch folder; `build/` is untouched) |
| In a browser | Headless Chrome against the dev server, with no API. Each address opened its screen with the right entry highlighted. `/access-orders/7` became `/access/orders/7`; `/digital-card?status=draft` kept its query. No errors in the page |

Not yet done: a pass against the live API, which only answers the panel's own origins.

## Not changed (follow-ups)

- **The article form's address preview is wrong:** it shows `glamlink.net/journals/<slug>`, but the website's address
  is `/journal/<id>/<slug>` (`articleHref` in the website's `src/lib/routes.ts`).
- **Backend (optional):** the order email could link straight to `/access/orders/:id`. The redirect covers it meanwhile.
- **Folder names** under `src/pages` keep the old layout (`Journal/Discover/Shop`, `JournalTopics`, `Sidebar/LoginActivity`)
  and the misspellings (`Directroy`, `Eductaion`). Addresses no longer depend on them.
- **After signing in**, the panel opens the Dashboard rather than the address you came from (audit X-05). An order email
  opened while signed out lands on the Dashboard.
- **Noticed:** Subscriptions treats every past-due seat as Pro. Since Nov 1, the backend counts only the first 21 days
  after a failed renewal.
- **`progress.md`:** audit items X-13 (sub-pages select their list) and X-04 (a 404 route) are done by this change.

## Every old address and where it goes

| Old address | New address |
| --- | --- |
| `/viewProfessionals/:id` | `/professionals/:id` |
| `/pages` | `/professionals/pages` |
| `/pages/new` | `/professionals/pages/new` |
| `/pages/:userId` | `/professionals/pages/:userId` |
| `/pages/:userId/analytics` | `/professionals/pages/:userId/analytics` |
| `/access-subscriptions` | `/professionals/subscriptions` |
| `/form` | `/professionals/applicant-forms` |
| `/specialities` | `/professionals/specialities` |
| `/add-specialities` | `/professionals/specialities/new` |
| `/edit-specialities/:id` | `/professionals/specialities/:id` |
| `/loginLogs` | `/professionals/login-activity` |
| `/digital-card` | `/access/cards` |
| `/addBusinessCard` | `/access/cards/new` |
| `/editBusinessCard/:id` | `/access/cards/:id` |
| `/access-orders` | `/access/orders` |
| `/access-orders/:id` | `/access/orders/:id` |
| `/access-pricing` | `/access/pricing` |
| `/access-analytics` | `/access/analytics` |
| `/directory-applications` | `/directory/applications` |
| `/directory-applications/add` | `/directory/applications/new` |
| `/directory-applications/:id` | `/directory/applications/:id` |
| `/directory-applications/edit/:id` | `/directory/applications/:id/edit` |
| `/directory-claims` | `/directory/claims` |
| `/directory` | `/directory/sections` |
| `/partner-inquiries` | `/inquiries/partners` |
| `/view-partner-inquiry/:id` | `/inquiries/partners/:id` |
| `/feature-requests` | `/inquiries/feature-requests` |
| `/newsletter` | `/inquiries/newsletter` |
| `/journals` | `/journal/articles` |
| `/add-journal` | `/journal/articles/new` |
| `/edit-journal/:id` | `/journal/articles/:id` |
| `/journal-categories` | `/journal/categories` |
| `/authors` | `/journal/authors` |
| `/journal-faqs` | `/journal/faqs` |
| `/journal-topics` | `/topics` |
| `/journal-topics/add` | `/topics/new` |
| `/journal-topics/:id` | `/topics/:id` |
| `/journal-topics/edit/:id` | `/topics/:id/edit` |
| `/shop` | `/shop/products` |
| `/add-shop` | `/shop/products/new` |
| `/edit-shop/:id` | `/shop/products/:id` |
| `/magazine` | `/media/magazine` |
| `/magazine/add` | `/media/magazine/new` |
| `/magazine/edit/:id` | `/media/magazine/:id` |
| `/watch/videos` | `/media/videos` |
| `/watch/videos/:id` | `/media/videos/:id` |
| `/watch/series` | `/media/series` |
| `/podcast-schedule` | `/media/podcast-schedule` |
| `/add-podcast-schedule` | `/media/podcast-schedule/new` |
| `/edit-podcast-schedule/:id` | `/media/podcast-schedule/:id` |
| `/education` | `/discover/education` |
| `/add-education` | `/discover/education/new` |
| `/edit-education/:id` | `/discover/education/:id` |
| `/events` | `/discover/events` |
| `/add-event` | `/discover/events/new` |
| `/edit-event/:id` | `/discover/events/:id` |
| `/add-ad` | `/ads/new` |
| `/view-ad/:id` | `/ads/:id` |
| `/edit-ad/:id` | `/ads/:id/edit` |
| `/home-page` | `/website/home-page` |
| `/search-terms` | `/website/search-terms` |
| `/adminList` | `/admins` |
| `/addAdmin` | `/admins/new` |
| `/viewAdmin` | `/account` |
| `/reset-password` | `/account/password` |

Unchanged: `/` (Dashboard), `/professionals`, `/shop/tags`, `/ads`, `/login` and `/error401`.
