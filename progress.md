# Audit progress

Tracks the work done against the code and dependency audit of the admin panel, taken at commit `4ebfc15` on `main` on Oct 15. The [audit doc](https://claude.ai/code/artifact/e5486df6-a77d-4fd4-abc6-0030334b5224) now holds the Oct 30 re-audit of `d681084` (see [Oct 30 audit](#oct-30-audit)); the Oct 15 version is in its history.

- **Branch:** `main`. Pass 10 is `b75b38b`, followed by `ed32708`, which only changes line endings to LF; passes 1–9 end at `2970239`. `main` ends with pass 13 (Nov 4). Pass 10 is live on admin.glamlink.net (built Oct 27), on the new API. Passes 11 (Nov 1–2) and 12 (Nov 3) are on `main` (committed Nov 4), pushed and deployed (see [pass 11](#11-access-orders-listing-claims-and-card-types-nov-12) and [pass 12](#12-profile-pages-and-journal-cropping-nov-3)). Pass 13 (Nov 4) is on `main` too, pushed and not deployed: it needs the backend's product tags, which deploy first (see [pass 13](#13-product-tags-categories-and-the-button-label-nov-4)).
- **Status as of:** 2026-11-04 for pass 13; 2026-11-03 for passes 11 and 12; the rest as of 2026-10-30.
- **Backend questions:** the security questions in [Admin panel security: backend changes and questions](https://claude.ai/code/artifact/7cf1fb80-6241-4282-b8a6-9966c6290ed9) were all answered on Oct 16, and the panel made its changes in pass 9. Items 4–7 there still stand; its Oct 30 status note lists them.
- **Backend requests (pass 10):** [Glamlink Backend Requests — Admin Panel](https://claude.ai/artifact/Qb8i2fdiYQAN6TNMUG86KY): what the backend should change, with a status per row (the findings table in pass 10, kept up to date there).
- **Not yet done:** a manual pass in a real browser. Pass 10 runs against the new API on admin.glamlink.net, but there is no record of anyone clicking through it. The Oct 30 audit found P0 and P1 bugs that such a pass would likely hit, so do it after those fixes (see [Oct 30 audit](#oct-30-audit)).

## At a glance

| Measure | At audit (`4ebfc15`) | Now |
| --- | --- | --- |
| Clean `npm ci` | Fails (ERESOLVE) | Passes |
| `npm audit` | 143 advisories (4 critical, 45 high) | 0 |
| Packages in lockfile | 1,739 | 362 (the count `npm audit` checks) |
| Direct dependencies | 41 (no dev dependencies) | 27 + 14 dev (`react-image-crop` added Nov 3); 2 unused (`papaparse`, `@types/papaparse`) |
| Production JS | 6.2 MB (1.62 MB gzipped), one file | 3.00 MB (917 KB gzipped) in the main file with pass 13 (2.99 MB, 914 KB before it; 2.91 MB, 891 KB on Oct 30) |
| UI kits / icon sets | 5 / 5 | 1 / 1 (antd, `@ant-design/icons`) |
| Jobs done by two or more libraries | 10 | 1 since Nov 3: image cropping (`antd-img-crop` on most screens; `react-image-crop` for the Journal's free crop, which `antd-img-crop` can't do) |
| Routes unreachable from the UI | 29 | 0 (deleted) |
| `console.*` calls | 320 (including credential logging) | 111 in the source, all `console.error`; none in production builds |
| Tests | None | 267 in 48 files (Vitest; 245 in 44 before pass 13, 170 in 36 before pass 12, 153 in 32 before pass 11) |
| Lint | ESLint (CRA): 51 hook-dependency and 14 anchor warnings | oxlint: 0 errors; 16 warnings (14 hook deps, 1 anchor, 1 missing key), all in older files |
| Colour literals outside the global stylesheet | 876 in 71 files (266 distinct values) | 0, enforced by a test; card-data swatches excepted |
| Language | JavaScript | TypeScript, `strict` mode, 0 type errors; the build fails on a type error |

Against the audit's "Fix first" list, 4 of 5 items are done; the fifth (a new, restricted Maps key for the panel) is partly done. Of the 23 confirmed bugs, 12 are fixed, 9 went with removed screens, 1 is partly fixed (a missing key) and 1 is open (the Specialities page bug). The bug list was intentionally left for a later pass; the ones fixed went away as a side effect of other work: the TypeScript migration (see [Found during the TypeScript migration](#found-during-the-typescript-migration)), the security pass (session handling) and pass 10.

## Oct 30 audit

A fresh, read-only audit of `main` at `d681084`, with an API contract check against the backend (`master` `aadb56a`). It is now in the [audit doc](https://claude.ai/code/artifact/e5486df6-a77d-4fd4-abc6-0030334b5224). It found 143 issues: 1 P0, 11 P1, 59 P2 and 72 P3; the contract check adds 2 P0s that break admin screens.

The newer screens (pass 10) are solid. Every P0 and P1 sits in the older, migrated screens: card create and edit, articles, Education, Events and Shop, Ads, Directory Sections and User Login Activity. Checks on `d681084`: 0 type errors, oxlint 0 errors and 16 warnings, 153 tests in 32 files pass, `npm audit` 0, one 2.91 MB (891 KB gzipped) bundle.

**Fix first** (S is under half a day, M is half a day to 2 days):

| ID | Sev | What | Effort |
| --- | --- | --- | --- |
| A-CNT-1 | P0 | Backend: saving an article that has topics answers 500 and soft-deletes its topic links; live, all 6 topics list 0 articles. Hard-delete the links in one transaction, then repair the data. | S |
| X-01 | P0 | Links from the public partner form and from guest card drafts open with `window.open` (`PartnerInquiries.tsx:104`, `ViewPartnerInquiry.tsx:131`, `BusinessCard.tsx:952-995`); a `javascript:` link can read the token in `localStorage`. Allow only http(s) links; the backend checks URLs on public forms. | S |
| A-OTH-1 | P0 | Expanding a user in User Login Activity blanks the panel: new logins store no IP, and `LoginLogs.tsx:65` calls `.split` on null. Null-safe cell; the backend saves the IP. | S |
| A-01 | P1 | Create card: the Link dialog's inputs overwrite the bio with the URL or `"on"` | S |
| A-02 | P1 | Edit card: a card whose saved video has no thumbnail can never be saved | S/M |
| J-01 | P1 | Dragging rows while a search is active saves a partial order and hides the other rows (Journals, Education, Events, Shop) | S |
| J-02 | P1 | Edit article wipes its topics and FAQs when any of 8 lookups fails or is slow | S |
| J-03, W-01 | P1 | The strings `"undefined"` and `"null"` are saved and shown on the website (event location, education category, directory section description) | S |
| J-04 | P1 | No submitting state on the Discover forms, Authors and Categories: double clicks create duplicates, and an Add Shop retry creates a second product | S |
| M-01 | P1 | Ad start and end times drift by the admin's UTC offset on every save | S |
| M-02 | P1 | Video ads are stored at half the slot size, and the website draws them at that size | S |
| M-03 | P1 | The `journal-listing-in-feed-2` ad slot can't be used at all | S/M |
| A-03 | P1 | Access Orders reaches only the newest 10 orders (the backend reads paging from `req.body`). **Nov 2:** the backend reads the query string (A-ACC-1, built Nov 1, not deployed) and pass 11 pages on the server; closes when both ship | M (backend) |

Add a regression test with each fix: 14 page areas have no tests, and every P1 flow is among them (card create and edit, article add and edit, the Discover forms, ads, podcasts; T-01).

**Then:**

1. **Platform safety net (M):** an error boundary (X-03; a dozen render-time throws blank the whole panel), keep the page after sign-in (X-05), a re-sign-in that doesn't unmount the page (X-06), a 404 route (X-04), a global 403 handler (X-08).
2. **Backend requests** that unblock panel fixes: access-orders paging from the query (A-03; built Nov 1, not deployed), name and email on subscription seats (A-25), `topic_ids` on product and podcast saves (J-13), one endpoint for an article's paragraph tags (J-07), raw Publuu fields in the magazine admin view (M-08), URL validation on public forms (X-01), `ip_address` on login records (A-OTH-1). From the contract check: product and podcast saves fail after a topic is deleted (A-CNT-4), and CSV import is refused for `application/vnd.ms-excel` and times out on large files (A-CNT-5, A-CNT-6).
3. **Browser QA** against the live panel, after the fixes above. Priorities:
   - the new screens, with real data: pricing and subscriptions (Stripe test keys), buying and voiding a label (Shippo test keys), approving a directory application, importing a YouTube link;
   - visual changes from antd 6;
   - video previews, the rich-text editor on the journal pages, image cropping.
4. **Consolidate the older screens (L):** shared `SortableTable`, `CoverImageField`, `DiscoverList`/`DiscoverForm`, one card form, one article form; route-level lazy loading (X-09); one date helper (X-10).
5. **Retire or rethink** (owner decisions): Applicant Form (W-07, a CRM-era gate nothing submits to), User Login Activity (S-01 to S-03), the duplicate YouTube import on Podcast Schedule (M-07).
6. **Hygiene (S):**
   - delete the untracked report files (R-01): `migration-report/`, `src/migration-report/`, `src/audit-report.sh` and `src/audit-report.txt`, JS-era reports about code that no longer exists;
   - remove `papaparse` and `@types/papaparse` (R-02), `src/types/dashboard.ts` (R-03) and the unused `VITE_VIDEO_BASE_URL` (R-04);
   - fix the misspelled names (R-08);
   - keep this file current.

## Work done

Thirteen passes, in order. Each pass was verified with a production build before the next one started.

### 1. One job, one library

- antd is the only UI kit. PrimeReact, react-bootstrap, MUI v4/v6, MUI X DataGrid, emotion, and the Bootstrap, Popper and Font Awesome CDN files are gone.
- `@ant-design/icons` is the only icon set. react-icons, PrimeIcons and `@mui/icons-material` are gone.
- Notifications use antd only (react-toastify removed). Tables use antd Table only.
- Dates use dayjs only. moment is removed; the `customParseFormat` plugin is set up in `src/config/dayjs.ts`.
- Charts use chart.js / react-chartjs-2 only. `@ant-design/plots` is removed.
- Image cropping uses antd-img-crop only, wrapped by `src/components/ImageCropModal.tsx`. The separate react-easy-crop cropper and `getCroppedImg` are removed.
- Removing the MUI packages fixed the `npm ci` ERESOLVE failure.

### 2. Editor and router

- **TinyMCE (cloud) and CKEditor 5 → Tiptap 3**, as one shared editor: `src/components/RichTextEditor.tsx` plus `src/components/richText/extensions.ts`.
- **No API key or cloud script is needed for the editor anymore.**
- HTML saved by the old editors loads and saves back unchanged. That covers:
  - journal topic tags (`data-paragraph-id`, `data-topic-ids`, `data-topic-names`);
  - business mentions (`mention-tag`, `data-card-id`);
  - `<video><source>`, inline iframes, table borders and cell widths, fonts, colours, alignment and inline images.
- Tests in `extensions.test.ts` lock this behaviour in.
- **`react-router-dom` → `react-router`** (v7 at this step; v8 since pass 5).

### 3. Dead code

- **Deleted the 29 unreachable route entries and their 28 page files:**
  - Blogs and Blog categories
  - Support, Terms & Conditions, About Us
  - Old Services
  - Add User, Edit Admin, Settings, Personal Information, Forgot Password
  - Upload CSV, Promotion Request, the `/view-order/:id` route
- **Also deleted the API code only those pages used:** `BlogsApi`, and unused exports in `Api.ts`, `AppointmentsApi.ts` and `Host.ts`.
- **Restoring a page:** everything is in git history at `4ebfc15`.
- **Template leftovers removed:**
  - `manifest.json` and the stock React logos
  - the "Enter your description here" meta tag
  - starter-template CSS (`.quill`, `--color-ffd333`, `.red`, invalid `font` shorthands)
  - the unused ToastContainer
  - Banner's redirects to routes that only exist in the professional app
  - the dead `signout` key handler
- **Logging and comments:**
  - commented-out code and debug `console.log` calls are removed, including the one that printed the admin's email and password on every login;
  - logs on error paths became `console.error`.
- **Renamed:** `glamlink in black (1).png` → `src/assets/glamlink-logo-black.png`.

### 4. Build tooling

- **Create React App → Vite 8**: dev server on port 3000, output still in `build/`.
- **Tests:** Vitest 5 with jsdom and Testing Library, 21 tests. They cover:
  - routing;
  - the rich-text editor (toolbar modes, late-loading values, topic tagging);
  - legacy HTML round-trips;
  - dayjs parsing.
- **Lint:** oxlint, configured in `.oxlintrc.json`.
  - Real bugs are errors: undefined variables, hook-rule violations, duplicate JSX props.
  - Not enforced yet: React Compiler readiness rules and the stricter accessibility rules. They are listed in the config, to be turned on area by area.
- Node version pinned through `engines`: `^22.22.2 || >=24.15.0`.
- **Environment variables were renamed from `REACT_APP_*` to `VITE_*`.** Deployment and CI configs must use the new names (see `.env.example`).
- ffmpeg.wasm now loads its ESM core, because Vite runs its worker as a module worker.
- `README.md` was rewritten (stack, setup, env vars, scripts, layout).

### 5. Latest stable versions

| Package | Before → after | Notes |
| --- | --- | --- |
| react, react-dom | 18.2 → 19.3.1 | Required by react-router 8 |
| antd | 5.11 → 6.6.6 | Prop renames applied in 23 files (see below) |
| @ant-design/icons | 5.6 → 6.3.4 | Matches antd 6, so only one copy is installed |
| react-router | 7.18 → 8.4.0 | Needs React ≥ 19.2.7 and Node ≥ 22.22. None of the v8 breaking changes affect the APIs we use. |
| axios | 1.5 → 1.20.0 | Clears its advisories |
| dompurify | 2.4 → 3.4.17 | Clears its advisories; same `sanitize()` API |
| chart.js / react-chartjs-2 | 4.4 → 4.5.1 / 5.2 → 5.3.1 | |
| dayjs | 1.11.20 → 1.11.23 | |
| papaparse | 5.4 → 5.7.0 | |
| react-player | **Removed** | All 8 players show our own uploaded files. Replaced with the native `<video>` element, at the same 360 px height. |
| @floating-ui/dom | **Removed from `package.json`** | Not imported by our code; Tiptap installs it on its own |

- **antd 6 dropped `visible` on Modal and Drawer.** Six modals and the Product drawer would never have opened. They now use `open`: Specialities, the product and service category editors, ProfessionalForm, and the Product drawer.
- **Other antd 6 renames:**
  - `bodyStyle` → `styles.body`
  - `destroyOnClose` → `destroyOnHidden`
  - `maskClosable` → `mask.closable`
  - Space `direction` → `orientation`
  - Divider `type` → `orientation`, and `orientation="left"` → `titlePlacement="start"`
  - Drawer `width` → `size`
  - Card `bordered` removed (it is now the default)
  - `notification` `message` → `title`
- **Check:** all 83 routes were rendered in the test environment with the API mocked. No antd deprecation warnings or React 19 warnings appeared.

**Already on the latest version:** Tiptap, @dnd-kit, antd-img-crop and browser-image-compression. (ffmpeg.wasm was later replaced by Mediabunny, pass 9.)

### 6. TypeScript

- **All 137 source files are TypeScript** (44 `.ts`, 93 `.tsx`), compiled by TypeScript 7 in `strict` mode with 0 errors. There is no `any` and no `@ts-ignore`.
- **Checks:**
  - `npm run typecheck` runs `tsc`, and `npm run build` now runs it first, so a type error fails the build.
  - oxlint gained its TypeScript rules. `no-undef` is off because `tsc` reports undefined names better.
- **Domain types:** `src/types/` (14 files, about 970 lines) describes every API response and record the pages use: users, posts and clips, catalog, e-commerce, journals, access cards, analytics, ads and more.
  - All 23 API modules are typed against these, so `result.data.data` has a real type on every page.
  - The types were inferred from how the pages read each response, not from a backend schema. Fields the code treats defensively are optional. When the API turns out to differ, fix the type and `npm run typecheck` lists every page affected.
- **Shared helpers added in `src/utils/`:**
  - `apiError.ts`: typed readers for a failed request (`apiErrorStatus`, `apiErrorMessage`, `apiErrorBody`), plus `errorMessage` and `isFormValidationError`.
  - `table.ts`: `TableParams`, `TableChangeHandler`, `WithIndex` and `singleSorter`, for the list pages' pagination and sort state.
  - `routing.ts`: `useIdParam()`, for pages routed with `:id`.
  - `apiList.ts`: reads the list endpoints that answer in three different shapes.
- **Small refactors done where typing required them:**
  - **ImageCropModal** now receives the whole new file list, and remembers the latest list itself so several crops in a row still append.
  - **Video `<Upload>` on Edit Access Card:** its unused `fileList` prop was dropped, matching the Create page.
  - **Access-card gallery:** saved images keep their numeric id in a `mediaId` field, so `existing_image_ids` is sent exactly as before.
- **Escape hatches:** 24 non-null assertions and 28 casts, all at boundaries, with a comment where the reason isn't obvious. Examples:
  - picked upload files always carrying `originFileObj`;
  - antd's `customRequest` file;
  - the dashboard hover handlers styling `e.target`.
- **Behaviour was kept the same**, apart from the handful of fixes listed in [Found during the TypeScript migration](#found-during-the-typescript-migration).
  - **How this was checked:** all 83 routes were rendered in the test environment before and after, and the console output matched.
  - **One harmless change:** arguments the API functions already ignored (mostly tokens) were removed from the calls.

### 7. Security (panel side)

Frontend-only fixes from the audit's security list. Anything that needs a backend decision is in the [backend questions doc](https://claude.ai/code/artifact/7cf1fb80-6241-4282-b8a6-9966c6290ed9) instead.

- **Stored HTML is sanitized everywhere it is rendered.**
  - `src/utils/sanitizeHtml.ts` wraps DOMPurify with the panel's allowlist, and `src/components/SafeHtml.tsx` renders through it. All 6 `dangerouslySetInnerHTML` sites now use `SafeHtml`: card bio (2), product description, FAQ answer, topic description, service description.
  - **Kept:** formatting, links, images, tables, `video`/`source`, `class`, `style` and `data-*` (the editor's topic tags and mentions), and `https` iframes, which get a `sandbox`.
  - **Removed:** scripts, event handlers, `javascript:` URLs, non-https iframes, `<style>` tags, forms, and `position` in inline styles (so content can't cover the page with a fake screen). Links with `target` get `rel="noopener noreferrer"`.
  - **The editor sanitizes too:** initial content, content loaded later, the HTML source view, and paste/drop. Its iframe node also refuses non-https sources. Journal bodies can be created through endpoints that take no token, so an admin opening one in the editor was an XSS path.
- **CSV exports (Users, Products) are escaped.** Cells starting with `=`, `+`, `-` or `@` get a leading apostrophe, so a seller or user name can't run as a spreadsheet formula. Phone numbers and plain numbers are left alone. Names with commas or quotes no longer break the row, and `#` no longer cuts the file short. Shared helper: `src/utils/csv.ts`.
- **One place owns the session: `src/utils/session.ts`.**
  - `getToken`, `setToken`, `clearSession` and a `useSessionToken()` hook. MainLayout re-renders from it, so signing out (here or in another tab) shows the login form at once. Pages still read `localStorage.getItem("adminToken")` directly; only saving and clearing moved. (Superseded in pass 9: no page reads it any more.)
  - **A global axios response handler ends the session** when a request that carried the current token gets a `jsonwebtoken` error back (`jwt expired`, `invalid signature`, `jwt malformed`, `invalid token`). It clears the token and shows "Your session has expired" once. Before, an expired session went to the login page but kept the token. The handler ignores requests sent with an older token or none.
  - **401 does not log out yet.** 13 save handlers read 401 as "expired" (they now call `clearSession()`), but 30 list pages read it as "not allowed for this role". The backend doc asks which is right (section 3). (Superseded in pass 9: a 401 now always ends the session.)
  - The local "jwt expired" branches in 7 list pages are removed; they would have shown the message twice.
- **MainLayout** loads the profile and badge counts only when signed in, and again after signing in inside the layout (before, the header name stayed empty until a reload). The badge counts now send the token.
- **Login** refuses a response without a token instead of saving the string "undefined", and shows an error for failures it doesn't recognise (before, they showed nothing). Tokens saved as "undefined" or "null" by older builds count as signed out.
- **Podcast schedules:** "get by id" and "delete" now send the token (they sent `Bearer undefined`).
- **Search engines:** `index.html` carries `<meta name="robots" content="noindex, nofollow">`. `public/robots.txt` keeps crawling allowed on purpose, with a comment saying why: search engines only honour `noindex` on pages they may fetch, and `Disallow: /` would let a linked URL be listed without its content. The backend doc also asks the host for an `X-Robots-Tag` header.
- **The ffmpeg core ships with the build** instead of loading from unpkg at run time. `@ffmpeg/core` 0.12.10 is a dependency now (the code had pinned 0.12.6 on the CDN), so `package-lock.json` pins its integrity hash, and the ad video cropper loads it through Vite `?url` imports. Checked in headless Chrome against both the dev server and a production build: the core loaded, cropped and encoded a test clip, and no request left the site. The build now contains a 32 MB `ffmpeg-core-*.wasm`, still downloaded only on the first crop; the README warns that some hosts cap file size (Cloudflare Pages: 25 MiB). (Superseded in pass 9: Mediabunny replaced ffmpeg, and the core is gone.)
- **Google Maps loads on first use** (`src/utils/googleMaps.ts`) instead of from a synchronous script tag on every page. Only the access card forms use it (address autocomplete, city geocoding), so the login page and the rest of the panel no longer run a Google script or expose the key. It uses Google's async loading (`loading=async` + `importLibrary`), which also silences Google's console warning about synchronous loading. Checked in headless Chrome: one script tag however many fields ask, `places.Autocomplete` and `Geocoder` available, and the login page requests nothing from Google except Fonts.
- **The image-compression worker loads its library from our build.** browser-image-compression runs in a web worker that, by default, loads the library from the jsdelivr CDN with `importScripts()`. The audit missed this one. `ImageCropModal` now passes `libURL`, pointing at the copy Vite emits (`assets/browser-image-compression-*.js`). Checked in headless Chrome against a production build served by a logging server: a 3000×2000 photo came back at 2000×1333 and the worker fetched our copy. The library's CDN default is still in the bundle as a string, but it is used only when `libURL` is missing.
- **Production builds drop every `console.*` call** (`vite.config.ts`: Rolldown's `compress.dropConsole`). Error logs print whole axios errors, request headers and the admin token included, and anyone shown the console or sent a screenshot could copy them. Dev and tests keep the logs. Production loses them too, so add an error reporter (e.g. Sentry) if production errors need to be seen.
- **Tests:** 25 new (sanitizer, CSV escaping, Maps loader, hostile content in the editor, the session store and handler, sign-out, badge-count token, login without a token). All 83 routes render with the same console output as after the TypeScript pass.

### 8. One stylesheet, colour tokens

- **`src/index.css` is the only global stylesheet** and the one place a colour is written. `App.css` was merged into it and deleted.
- **Palette:**
  - primary `#226168`;
  - an off-white page (`--color-bg` `#f5f6f3`) and near-white panels (`--color-surface` `#fcfcfa`) instead of pure white;
  - greyish-black text (`--color-text` `#2b2f31`) instead of `#000`;
  - secondary and tertiary text and borders;
  - success, warning, error and info, each with a soft and a border shade;
  - a small accent set for categories and charts;
  - shadow and overlay colours.
- **Every file follows it:**
  - **CSS and inline styles:** all 876 colour literals in 71 files now use `var(--color-…)`. A codemod mapped each value by hue, lightness and use (text, background, border, shadow). Named colours used as CSS (`"red"`, `"gray"`, …) were changed by hand.
  - **antd:** themed app-wide from the same tokens (`src/config/theme.ts`, `ConfigProvider` in `App.tsx`): primary, links, status colours, text, backgrounds, borders, sidebar and font. Access Card Analytics no longer has its own primary colour.
  - **Tag and Badge presets:** antd's preset palette (`"green"`, `"purple"`, …) is mapped to the tokens too, so `<Tag color="green">` follows the palette without code changes. Booking tags that used `"black"` (not an antd preset; it rendered a solid black tag) now use `"default"`.
  - **Charts:** Chart.js draws on a canvas, which can't read `var()`, so the Dashboard charts read the tokens at render time (`cssVar()`, `withAlpha()`).
  - **Sass:** `color.adjust()` on the brand colour became tokens (`--color-primary-active`, `--color-primary-soft-hover`). Analytics' `rgba($brand, …)` became `color-mix()`.
- **Kept as literals, marked `color-literal-ok`:** values that are data, not panel styling:
  - access card brand colour presets and the default (saved with the card and shown on the public card);
  - the rich-text editor's colour-picker defaults and the video block's inline style (saved into article HTML).
- **Guard:** `src/theme.test.ts` fails on any hex, `rgb()` or `hsl()` literal outside `index.css`, on named colours in stylesheets, and on named colours in inline styles. A run with planted violations confirmed it catches each kind.
- **Fixes the theme exposed:**
  - The black logo sat on teal; its bar is now off-white and lines up with the header.
  - The SIGN IN label was dark on teal.
  - Three card-page buttons painted a primary background over a default button. They now use `type="primary"`, so hover works.
- **Checked** with screenshots in headless Chrome (login, dashboard, access cards, analytics, create card, admin profile), with the API stubbed.

### 9. Backend answers and the new API

The backend answered every question in the [backend questions doc](https://claude.ai/code/artifact/7cf1fb80-6241-4282-b8a6-9966c6290ed9) and listed what the panel must change for the new API (`api.glamlink.net`) in its `docs/handoff/admin-panel.md`.

- **Ad video cropping no longer needs ffmpeg.wasm (32 MB).**
  - It now uses the browser's own video encoder (WebCodecs) through Mediabunny (`src/pages/Ads/cropVideo.ts`): crop, scale to the slot's exact size, H.264 MP4, audio removed, as before.
  - Mediabunny is a 548 KB chunk (137 KB gzipped), loaded only when someone crops: about 75× less to download than the old core. `@ffmpeg/core`, `@ffmpeg/ffmpeg` and `@ffmpeg/util` are removed.
  - It's also faster (the browser's encoder, often on the GPU): a 2-second 720p clip cropped in under a second.
  - Checked in headless Chrome, dev and production builds: an MP4 source, and a portrait WebM (VP9) with Opus audio, both came out H.264 at exactly the slot size with no audio track.
  - Browsers without WebCodecs H.264 encoding get a clear message instead of a failed crop. The CSP no longer needs `'wasm-unsafe-eval'`.
- **One API client, as the backend asked.** Every admin endpoint now refuses a missing token.
  - `utils/session.ts` attaches `Authorization: Bearer <token>` to every axios call to `VITE_API_BASE_URL`, except the sign-in calls. Other hosts never get the token.
  - All per-call auth headers are gone: `x-access-token` in 55 calls and `Bearer` in 25. So are the token parameters of 22 API functions, their arguments at the call sites, and every `localStorage.getItem("adminToken")` in the pages (133 at audit time). The 122 calls that sent no token now send it. The service CSV upload moved from `fetch` to the API module so it gets the token too.
  - **401 now always means "sign in again"** (the API's `ADMIN_SIGN_IN_REQUIRED` / `ADMIN_SESSION_EXPIRED`): a 401 for the current token ends the session and shows the login form. A 401 from the sign-in call doesn't. The "jwt expired" checks are gone; the new API never sends them.
  - The 30 "not allowed" redirects moved from 401 to 403, which the API will use once admin roles are enforced. The 13 save handlers that cleared the session themselves now leave it to the shared client.
- **Sign-in, sign-out, password:**
  - Login shows the API's single message for every failure ("Invalid email or password.") and a wait message on 429 (15 tries per 15 minutes).
  - Sign out calls `POST /admin/auth/logout` first, which ends the admin's sessions on every device.
  - After a password change the panel signs out and asks for the new password: the API ends every session on a password change.
- **Endpoints, fields and URLs the new API changed:**
  - Renamed: `getBookingsByCounsellorId` → `getBookingsByProfessionalId` and `getAllReferralByBeauticianId` → `getAllReferralByProfessionalId` (functions renamed with them). Deleting an admin calls `DELETE /admin/deleteAdmin` with `{ admin_id }`; the old path never existed.
  - Request bodies: reviews-taken and availability send `professional_id` instead of `counselor_id`.
  - Response fields: `appointment_counselor` → `appointment_professional` (Appointments, both booking tabs, Dashboard). "Beautician" became "Professional" in the founder messages and the service list column.
  - **Add Admin** asks for a password (at least 8 characters); the API requires one. It shows the API's own 400 message (e.g. "Email already taken").
  - Service Categories and Appointments read the total from `data.count` (the backend confirmed the shape); pagination totals were missing before.
  - The 26 double-slash URLs (`/api/v1//journal/topic`) are fixed.
  - `.env.example` holds the new API's URLs; the README says the API only answers listed origins (local dev needs `http://localhost:3000` added).

### 10. Website first, and the new API's admin screens (Oct 28)

The backend's handoff note (`glamlink-backend/docs/handoff/admin-panel.md`) lists what the panel must and can do for the new API; the website comes first, the app in about three months. This pass removes the app's screens and builds the website's.

**Removed: the mobile app's screens.** The backend files these under `src/mobile/`, and the website signs in professional accounts only (`user` accounts are the app's). All restorable from `2970239`.

- Users (app accounts) and their detail screen with its 14 activity tabs (posts, clips, likes, comments, followers, following, reviews, bookings, services, availability).
- Posts, Clips, Appointments, Service Categories, Banner, app FAQs (`/faq`; the journal's FAQs stay), Referrals, Glam Rewards Rules, and Ecommerce (product categories, products, ratings, orders).
- On Professionals: the referral column, promotions and payouts. The founder badge stays (the website shows it).
- The old dashboard: every number on it was the app's (posts, clips, likes, bookings, time slots).
- 8 API modules, the social and e-commerce types, and the app fields of the user types. `Customer/Alert` moved to `components/DeleteConfirmButton`, `AccountFields` to `Professionals/`.

**New screens** (sidebar groups in brackets):

| Screen | Route | Handoff section |
| --- | --- | --- |
| Dashboard: work waiting, what is live, the last 30 days, inquiries, searches | `/` | (replaces the app's) |
| Profile Pages: list, edit, new brand page, claim email, analytics | `/pages`, `/pages/new`, `/pages/:userId`, `/pages/:userId/analytics` | 8.6, 8.13 |
| Directory Applications: list by status, view, approve (or as a brand), reject, edit, add, delete; badge | `/directory-applications…` | 8.5 |
| [Inquiries] Feature Requests, Newsletter (search, source, CSV export, delete) | `/feature-requests`, `/newsletter` | 8.4 |
| [Access Cards] Subscriptions (cancel, complimentary Pro) and Pricing (plans, prices with history, discounts, personal prices, settings and entitlements) | `/access-subscriptions`, `/access-pricing` | 7.1, 7.2 |
| [Media] Magazine (issues, their people), Videos (import a link, import playlists, people, topics), Video Series | `/magazine…`, `/watch/videos…`, `/watch/series` | 8.8, 8.9 |
| [Website] Home Page (hero and Find-a-Professional images, popular searches), Search Terms (most searched, found nothing) | `/home-page`, `/search-terms` | 8.2, 8.10 |

**Changed screens:**

- **Access orders:** buy a label (a rate picker), print, void, tracking; Access Pro-only orders say "Nothing to ship"; `/access-orders/:id` opens one order (the admin's order email links there).
- **Card requests:** a "Guest drafts" view (`?status=draft`); a draft's status shows as a tag, not a select.
- **Articles:** "Featured (Journal hero)"; after saving, the @handles that match no one; a "Featured people" panel (add, set aside, remove); a taken slug shows on its field.
- **Journal categories:** sidebar order, description, published article count.
- **Topics:** "Show on the home page", tile order and square tile image; a Home Page column on the list.
- **Shop products:** slug, the page's longer description, owner and brand pickers, "Featured on the home page" and its order; a deleted product (or education item, or event) says so instead of failing.
- **Ads:** views, clicks and click rate on the list for a date range; per-day numbers on an ad's page.
- **Podcast Schedule:** an "Import" button for the YouTube playlists. It is the same import as on Videos, so it is a duplicate, with drifted messages (Oct 30 audit, M-07).
- **Professional view:** the app activity card became "On the website" (page shown or why not, address, Access card, listing, topics, links to edit the page and its analytics); an empty profession shows nothing (it used to default to "Esthetician").
- **Sidebar:** grouped; the current page is highlighted and its group opens; group keys can't clash with routes; badges for applicant forms and directory applications, re-counted on each change of page. "Directory" is now "Directory Sections" (it edits the directory's sections; applications are separate).

**Shared pieces for these screens:** `components/PageHeader` (with `Panel`), `components/AccountSelect` (professional and brand accounts, by name, from the pages list), `components/ImageUploadField` (uploads through `POST /journal/upload`, keeps the link the API wants), `components/DateRangeFilter`, `utils/formErrors` (`showFieldError`: a refusal's `details.field` on its form field), `utils/money`, `utils/website` with the optional `VITE_WEBSITE_URL`, and `utils/compressImage` (shared with the image cropper).

**Fixed on the way:** the Specialities "view user" arrow (a broken route, and the API answers profile ids, not account ids: removed) and its "Number of Services" column (it counts professionals), "Failed to load education" on the event screen, the Professionals CSV export (now escaped like the others), the app-only "Welcome Melanie".

**Backend findings** (the panel works around each; each is worth a backend change). They are tracked for the backend, with smaller notes and server steps, in [Glamlink Backend Requests — Admin Panel](https://claude.ai/artifact/Qb8i2fdiYQAN6TNMUG86KY):

| Finding | Effect | Panel today |
| --- | --- | --- |
| `GET /businessCard/access-orders` reads `page`, `limit`, `search` and the status filters from `req.body`, which a GET has none of | The panel only ever gets the newest 10 orders | Says "the newest 10 of N"; asks for 200, which works once the API reads the query. Pass 11: pages on the server; the API reads the query since Nov 1 (not deployed) |
| The magazine's admin view has no raw `publuu_*` / `flipbook_url` fields, only the built `flipbook` | Saving an issue that has both a link and Publuu ids (or one id) clears what the form can't show | Sends what it shows |
| `social: []` on a page is stored as "no links", hiding the card's | The website's own owner editor sends `"[]"`, so an owner who clears their links hides the card's | Sends `null` for an empty list |
| `GET /profiles/admin/:userId` doesn't say whether the account is `claimed` | The page screen can't tell if a claim email is needed | Takes it from the list; a 409 ALREADY_CLAIMED hides the button |
| Subscription rows hold `user_id` only | No name or email in the list | Looks each account up once (at most 20 a page) |
| Approving a directory application saves the status before making the account | If making the account fails, it stays "approved" with no account | Reloads after a failed review; approving again retries |
| Analytics dates are checked against the database's "today" | An admin ahead of the server's day is refused for "today" | Leaves out a `to` of today or later |
| `PUT /journalCategory/:id` sets `description` only when it isn't empty | A category's description can't be cleared | (nothing) |
| The 14 seeded magazine covers are still on glamlink.net until `npm run magazine:covers` runs; the API refuses a cover not on its host | Sending the cover back unchanged would fail every save | Sends the cover only when it changed |

**Still in use but unmaintained:** browser-image-compression has had no release since March 2023. It does real work: it shrinks photos to at most 2000 px before cropping. Replace it with a small in-house resize helper when convenient.

### 11. Access orders, listing claims and card types (Nov 1–2)

For the backend's Nov 1 changes (its `docs/handoff/admin-panel.md`, the Nov 1 row) and Mohit's decisions of Nov 1. On `main` and not deployed: these screens call the backend's new answers, so the API deploys first.

- **Access Orders:** paging, search and the Payment and Fulfillment filters run on the server (50 a page, the total from `pagination.total`), so every order can be reached (A-03, with the backend's A-ACC-1). **Cancel order** (`POST businessCard/access-orders/:id/cancel`), with a confirmation in the owner's words and an optional reason: no refund, an unshipped keychain stops, the Access Pro bought with it ends at once. A cancelled order shows as such and is locked (no label bought or voided, no fulfillment change). The Dashboard's "Keychain orders to ship" counts paid orders that are pending or processing, from the API's totals.
- **Cards:** a Type column (Professional or Brand) and a Type filter on the list; a Type select on Create and Edit that sends `professional_type`; brand labels; the title is required for professionals only; notes that locations are optional.
- **Listing Claims**, a new screen (`/directory-claims`, in the sidebar after Directory Applications, with a badge of the claims to verify): To verify, Verified and All; Verify and Reject, each confirmed; the API's 409 (another card already has the listing) shown on the page; links to the listing on Google Maps and to the card.
- **Directory Applications:** the texts say the website's form is retired; the screens stay for the applications still pending and for the listings added here.
- **Shared pieces:** `utils/badges.ts` (a screen asks the sidebar to recount its badges, as Listing Claims does after a review) and `pages/BusinessCard/cardType.ts` (a card's type: labels, tag colours, options); `types/listingClaim.ts` and `services/Api/ListingClaimsApi.ts`.
- **Checks:** 170 tests in 36 files pass (153 in 32 before; new: the card list, Create card, Edit card, Listing Claims and a cancelled order as the API answers it), 0 type errors, oxlint 0 errors with the 16 older warnings, and `npm run build` passes.
- **Matched to the backend's code (Nov 2):** an order is cancelled when the API sets `cancelled_at` (its `payment_status` stays `paid`: refunds are made by hand), and the order's details show the cancel reason; the Payment filter's "Cancelled" sends `cancelled=true`, and the filter also offers `partially_refunded` and `disputed`. A repeat cancel answers the order unchanged rather than a 409, which the dialog handles the same way. Changing a card's type here changes its owner's account type too (the backend's Nov 2 change), so a card switched to Brand shows on the website's brand list.

### 12. Profile pages and Journal cropping (Nov 3)

For the backend's Nov 3 changes (its `docs/handoff/admin-panel.md`, the Nov 3 row and section 8.6) and Mohit's requests of Nov 3: admin screens for everything owners now edit on their profile, a read-only view of where a profile is tagged, and cropping on the Journal ("Presets + Manual + skip" for pictures in the text, with a free crop everywhere). On `main` and not deployed: the API deploys first.

- **Profile pages** (`/pages/:userId` is now in tabs, `?tab=page|media|education|tagged`):
  - **Page:** Intro (300 characters), Category (a brand's 8 categories as "<label> Brand", else a specialty from `GET /profession`), Shipping, an About image; the cover's hint says an empty cover shows the card's cover photo.
  - **Media & Images:** every item, hidden ones too; Hide and Show; caption and alt text; reorder (drag or arrows, the full order saved); delete; add photos (20 a request), MP4s with a poster made in the browser (`utils/videoPoster.ts`, the website's code), YouTube or Vimeo links, and the Access card's photos. The first 5 visible items are marked as the ones on the page.
  - **Education:** the posts with drafts, reorder, Publish and Unpublish, delete, View on site; the form takes a video (a link, or an MP4 with a poster) or an article written in the editor's new `article` mode, which keeps only what the API keeps.
  - **Tagged in:** the Journal articles and The Beauty Vault episodes the profile appears in, read-only, each linking to its edit screen; tags change on the article (an @handle or Featured people) or on the episode (People). The website's lists answer only for a page it shows, and the tab says so.
  - Page analytics name the new clicks (shares, media, education, the podcast, the Journal).
- **Journal cropping** (`components/ImageCropDialog.tsx`, with `react-image-crop`): Original, preset ratios, Free (drag any rectangle; arrow keys move it), a custom W:H ratio, and rotation, cut from the full-size picture (at most 4000 px on the long side).
  - **Pictures in the text:** the Image button, paste and drop open the crop before uploading (Original, 16:9, 4:3, 1:1, 4:5, Free, Custom, or "Use as is", with "Use as is for the rest" for several); a picture already in the text is cropped again with the scissors button.
  - **Cover:** 16:9 by default (Journal listings show 16:9), Free and Custom too, and "Crop again" from the original.
  - **Authors:** 1:1 with a round outline, Free and Custom, and "Crop again". The website now shows the author's photo where it showed their initial.
- **Leftovers of Nov 1–2:** special offers left the Access pricing settings, and analytics no longer says "not built yet" (A-29, part: "Priority placement in search" stays, marked not built); an order's details show its refund (full or partial), dispute and cancellation.
- **Tests:** a tear-down wait in `setupTests.ts`: React's scheduler could still have a task queued when a file's last test ended, which failed about one run in two with "window is not defined" once the suite grew.
- **Checks:** 245 tests in 44 files pass (170 in 36 before), three full runs clean; 0 type errors; oxlint 0 errors with the 16 older warnings; `npm run build` passes.

### 13. Product tags, categories and the button label (Nov 4)

For Mohit's decisions of Nov 4 and the contract written for them, which the backend builds at the same time: a product carries one tag, shown top-left on its card and its page, from a list admins keep; it has one of 8 categories; and its button can be renamed ("Shop now" when empty). Built against the contract, not a running API. On `main` (committed Nov 4) and not deployed: the API deploys first.

- **Product Tags**, a new screen (`/shop/tags`, in the sidebar after Shop): the tags in their order, each with an Editorial switch; add (a name of at most 40 characters, editorial or not), rename, reorder (drag or arrows, every id saved at once, as on the profile tabs), delete (the confirmation says the products carrying it lose the tag; the message after says how many did). A taken name (409 `TAG_EXISTS`) and a refused one (400 `INVALID_TAG`) show on the name field. One line says what editorial means: only admins can set it, so owners can't claim a feature they didn't get.
- **Add and Edit product** (in `ProductSiteFields`, so both forms):
  - **Category:** "No category" and the 8, in the website's order. A value saved before the list shows, marked "(not in the list)", and is left out of the save so it stays until another is picked: the API refuses anything but the 8.
  - **Tag:** "No tag" and every tag from `GET /discover/shop/tags`, the editorial ones marked (in the list and once chosen). The product's own tag still shows when the list can't load.
  - **Button label:** at most 30 characters, "Shop now" as the placeholder; empty means "Shop now".
  - Each is sent as the contract says, `""` clearing it; a refusal naming one of them shows on its field.
- **Product list:** Tag (editorial ones marked) and Category columns; the table now scrolls sideways, as the Journals list does.
- **Shared pieces:** `types/productTag.ts` and `services/Api/ProductTagsApi.ts`; the screen reuses the profile tabs' order saver (`ProfilePages/pageContent.ts`).
- **For the backend:** accept a product's unchanged category from before the list on save (the panel leaves it out; a form that sends it back gets a 400 on any edit); answer a `tag_id` that no longer exists with 400 `INVALID_PRODUCT` on `tag_id`, not a foreign-key 500; decide what making an open tag editorial does to the owners who set it (they can't change or clear it after: 403); put a new tag last in the order; map the CSV import's `merchant_category` onto the 8.
- **Checks:** 267 tests in 48 files pass (245 in 44 before; new: the tags screen, Add and Edit product, the product list, the sidebar entry, and what the fields send), 0 type errors, oxlint 0 errors with the 16 older warnings, and `npm run build` passes.

## Status against the audit

**Status values:** **Done**, **Partly** or **Open**. Paths are under `src/` unless shown otherwise.

### Fix first

| Item | Status | Notes |
| --- | --- | --- |
| Rotate leaked Google Maps / TinyMCE keys | **Partly** | The leaked keys are disabled (owner) and TinyMCE needs none. The backend rotated its own Google key. Still to confirm: a new panel Maps key restricted to `admin.glamlink.net`, in the existing Cloud project, set as `VITE_GOOGLE_MAPS_API_KEY`. |
| Remove the credential `console.log` in `Api.ts` | **Done** | |
| Sanitize the `dangerouslySetInnerHTML` sites | **Done** | 4 of the 10 sites went with deleted pages; the other 6 render through `SafeHtml` (pass 7) |
| Unblock `npm ci` | **Done** | |
| Confirm server auth for calls made without a token | **Done** | Confirmed and enforced by the backend; the panel sends the token everywhere |

### Security

| Area | Status | Notes |
| --- | --- | --- |
| Stored XSS | **Done** | All 6 sites render through `SafeHtml`; the editor sanitizes what it loads. Server-side sanitizing is asked for in the backend doc (section 5), because the app and website may render the same fields. |
| CSV formula injection (found in this pass) | **Done** | Users and Products exports escape cells through `utils/csv.ts` |
| Secrets in git history | **Done** | Keys rotated; the backend checked the panel's history (all branches) and found no backend secret, only a public Stripe publishable test key |
| Credential logging | **Done** | Login and user-list logs removed; no `console.log` left in the code; production builds drop all `console.*` calls |
| Calls without auth | **Done** | The backend now requires an admin token on every admin endpoint (25 public reads are public on purpose), and the panel sends `Authorization: Bearer` on every API call (pass 9) |
| Session handling | **Done** | `utils/session.ts`: one client, 401 ends the session, sign-out on the server, sign-out after a password change. Server side: 12-hour tokens, revocation, login rate limit. httpOnly cookies were declined for now (they need CSRF protection; planned with admin roles). |
| Third-party scripts | **Done** | Bootstrap, Popper and Font Awesome CDN files are removed; ffmpeg is gone (the browser's own encoder crops ad videos); Google Maps loads only on the access card forms; the image-compression worker loads its library from the build (found in this pass). Google Fonts remains (a stylesheet, no script). Restricting the Maps key is in the backend doc (section 6). |
| Indexing | **Done** | `noindex, nofollow` meta tag in `index.html`; `robots.txt` deliberately allows crawling so the tag is seen. An `X-Robots-Tag` header is asked of the host (backend doc, section 6). |
| Browser libraries with advisories | **Done** | axios, dompurify and react-router upgraded; moment, TinyMCE and CKEditor removed; `npm audit` is clean |

### Install & build

| Item | Status | Notes |
| --- | --- | --- |
| `npm ci` fails | **Done** | |
| Create React App deprecated | **Done** | Vite 8 |
| One 6.2 MB bundle, no route-level splitting | **Partly** | 2.91 MB / 891 KB gzipped now; still one file. Both editors' CDN scripts are gone; ffmpeg is replaced by a 137 KB (gzipped) chunk loaded only when cropping. Next step: `React.lazy` per route. |
| CKEditor is 21% of the bundle | **Done** | Removed |

### package.json review

All ten "same job, several libraries" rows are resolved:

| Job | Kept |
| --- | --- |
| UI components, styling | antd. Sass is kept only for the existing `.scss` files. |
| Icons | `@ant-design/icons`. The audit suggested also keeping react-icons for brand logos; it was dropped instead. |
| Rich-text editor | Tiptap (replaces both CKEditor and TinyMCE) |
| Charts | chart.js |
| Dates | dayjs |
| Image cropping | antd-img-crop |
| Notifications | antd `message` / `notification` |
| Routing | react-router 8 |
| Tables | antd Table |

Every package in the "deprecated, unmaintained, or due for replacement" table was removed, replaced or upgraded. There are two exceptions:

- **browser-image-compression:** kept, as the audit advised.
- **Google Places Autocomplete: Partly.** Its script now loads on first use (pass 7), but it still uses the legacy `places.Autocomplete` API (`utils/LocationAutocomplete.tsx`).

The version mismatches and duplicate copies are gone: Bootstrap CSS/JS is removed, and there is now a single `@ant-design/icons`, a single react-easy-crop (inside antd-img-crop) and no MUI. The "behind but not urgent" upgrades are done or no longer apply, because those packages were removed.

### Unused files and dead code

| Item | Status | Notes |
| --- | --- | --- |
| 29 unreachable routes | **Done** | Deleted; restorable from `4ebfc15` |
| `Forgotpassword.js`, `CustomInput.js`, `UploadCSV.jsx` | **Done** | Deleted |
| `manifest.json`, stock logos, `index.html` CDN scripts and placeholder description | **Done** | |
| Unused API exports | **Done** | |
| Banner redirects; dead `signout` handler | **Done** | |
| react-toastify | **Done** | Removed |
| Starter-template CSS | **Done** | |
| 320 `console.*` calls | **Done** | No debug logs left; the remaining `console.error` / `console.warn` calls on error paths are dropped from production builds |

### Broken code (23 bugs)

| Where | Problem | Status |
| --- | --- | --- |
| `Specialities.tsx:336` | Links to `/view-user/:id`; the route is `/viewUser/:id` | **Done** (pass 10): removed; the API lists profile ids, not account ids, so there is no account to open |
| `/view-order/:id`, `ViewOrder.tsx` | The route rendered ViewOrder with no id; `onClose` is never called | **Gone** (pass 10): the app's orders screens are removed |
| `Banner.tsx`, `ProfessionalForm.tsx`, `Product.tsx` | Sorter reads `a.user_profile.name` | **Done** (TypeScript migration): each now sorts by the name its column shows |
| `Specialities.tsx`, `ProductCategory.tsx` | Stale `tableParams.pagination.current` overwrites the requested page | **Open** in Specialities; ProductCategory is gone (pass 10) |
| `Orders.tsx` | Search reads a different path than the column shows | **Done** (TypeScript migration): searches the customer name the table shows |
| `MainLayout.tsx:104,120` | Badge counts requested without the token | **Done** (security pass) |
| `MainLayout.tsx` | Profile and counts fetched on mount, before login | **Done** (security pass): they load once signed in |
| `MainLayout.tsx:70,87` | Expired session keeps the token | **Done** (security pass): cleared by the global handler |
| `MainLayout.tsx:168` and menu items | `defaultSelectedKeys={[""]}`; parent and child share keys `/journals`, `/podcast-schedule`, `/product-category` | **Done** (pass 10): groups have their own keys, and the current page is selected |
| `Login.tsx:33` | `error.response.data` read without a guard | **Done**: errors are read through `apiErrorMessage`; unknown errors now show a message, and a missing token is refused (security pass) |
| `Dashboard.tsx:433` | Professionals chart uses `period`, not `professionalPeriod` | **Gone** (pass 10): the dashboard was rebuilt for the website |
| `Dashboard.tsx:1243,1280` | Dropdowns default to "week"; state starts at "today" | **Gone** (pass 10) |
| `Dashboard.tsx:96` | Y-axis `max: 50` cuts off larger values | **Gone** (pass 10) |
| `Dashboard.tsx:1081` | `rowKey="course_id"`, a field the rows lack | **Gone** (pass 10) |
| `User.tsx:106,174` | Sort fields look swapped; search covers only the current page | **Gone** (pass 10): the app users screen is removed |
| `AddAdmin` | "Select Role" option could submit `role_id = NaN` | **Done** (now an antd Select with a placeholder) |
| 7 files | antd props passed to PrimeReact buttons | **Done** (PrimeReact removed) |
| `AdminUser.tsx` | `<div s>` typo | **Done** |
| Missing React keys (6 places) | | **Partly**: `CreateBusinessCard.tsx:1225` remains; the rest went with deleted pages and modals |
| `AppointmentsApi.ts`, `ClipsApi.ts`, `PostApi.ts` | `timezone: "Asia/Kolkata"` hard-coded | **Gone** (pass 10) |
| `DashboardApi.ts:16,22` | `BASE_URL + "/admin/..."` gives `//admin` | **Gone** (pass 10) |
| `Product.tsx:319` | Effect depends on `[tableParams]`; every sort or page click refetches everything | **Gone** (pass 10) |
| `Banner.tsx` | Redirects to six routes that don't exist here | **Done** (removed) |

### Mismatched UI

| Item | Status | Notes |
| --- | --- | --- |
| Several kits on one screen | **Done** | antd everywhere |
| No shared theme; several brand-teal shades and blues | **Done** | One palette in `index.css` and an app-wide antd theme built from it (pass 8); a test keeps colour literals out of every other file |
| 15 date display formats | **Open** | Now about 18 display formats and 4 picker formats, including both `DD/MM/YYYY` and `MM/DD/YYYY` (Oct 30 audit, X-10) |
| "Welcome Melanie", "Employee(s) deleted", "Number of Services", two "Status" columns in Products, Change Password at `/reset-password` | **Partly** | Pass 10: the greeting went with the old dashboard, the Products columns with the app's screens, and Specialities' count is titled "Professionals". The delete message now says "User(s) deleted"; only a log line still says "employee(s)" (`Professionals.tsx:299`). `/reset-password` remains. |
| Current page never highlighted | **Partly** | Pass 10: the sidebar selects the current page and opens its group, and a sub-page under its list's path selects its list. The 20 add, edit and view routes outside their list's path select nothing (Oct 30 audit, X-13). |
| Scrollbars hidden (`index.css`, `MainLayout.scss`) | **Open** | |
| Header menu needs Bootstrap JS; `<li>` in a `<div>`; "Sign Out" link without `to` | **Done** | antd Dropdown |
| Banner row checkboxes with no bulk action | **Done** | Removed |
| Orders shows plain "Loading..." text | **Gone** | The app's orders screen is removed (pass 10) |
| Deprecated antd props (`visible`, `bodyStyle`) | **Done** | Part of the antd 6 migration |
| 14 `<a>` elements without `href` | **Partly** | 1 left: `Specialities.tsx:62` (lint `anchor-is-valid`) |

### Code health

| Item | Status | Notes |
| --- | --- | --- |
| No shared HTTP client; two auth schemes | **Done** | One client in `utils/session.ts` sends `Authorization: Bearer` on every call (pass 9) |
| List-page logic copy-pasted about 40 times | **Open** | |
| Lint findings | **Partly** | Now oxlint: 0 errors; 16 warnings (14 hook-dependency, 1 anchor, 1 missing key) |
| Misspelled file names | **Partly** | Logo renamed; `ViewSericeCategory.jsx` deleted; `AddServiceCategroy.tsx` and `EcommeceApi.ts` went with the app's screens (pass 10). Still misspelled: `Directroy.tsx`, `Eductaion/AddEduction.tsx`, `Eductaion/Eduction.tsx`, `Viewad.tsx`, `Businesscard.scss`. |
| No tests, boilerplate README, no Node pin | **Done** | 170 tests in 36 files (Nov 2), new README, `engines` set (no `.nvmrc`) |

## Decisions to revisit

Choices made along the way that are worth a second look. None blocks anything today.

| Decision | Why it was made | What would change it |
| --- | --- | --- |
| Production builds drop every `console.*` call, `console.error` included | Error logs print whole axios errors, the admin token in the request headers included | Adding an error reporter (e.g. Sentry) to see production errors |
| Ad videos are cropped with the browser's encoder (WebCodecs), not ffmpeg.wasm | 32 MB less to ship and download, and faster | An admin browser without WebCodecs H.264 encoding (old Safari or Firefox) or one that can't decode a source format such as HEVC (it couldn't preview that video either); server-side cropping would cover both |
| `robots.txt` allows crawling, against the audit's suggestion | Search engines only honour `noindex` on pages they may fetch | Nothing, unless the host adds an `X-Robots-Tag` header; then either works |
| antd's preset tag colours (`"green"`, `"purple"`, …) are themed rather than replaced | One mapping in `config/theme.ts` keeps all tags on the palette without touching 60+ call sites | Wanting tag colours by meaning only (`success`, `error`, …); then replace the names |
| Panels are near-white (`#fcfcfa`) on an off-white page (`#f5f6f3`) | You asked for no pure white; panels still need to stand out from the page | Taste: change `--color-surface` / `--color-bg` in `index.css` |
| The sidebar is dark slate (`#263033`), and the logo bar off-white | antd's default navy clashed with the teal, and the black logo can't sit on dark teal | A light sidebar, or a white logo file |
| Access card brand colours (default `#23B9CD` and 8 presets) stay as they were | They are card data saved to the backend and shown on public cards, not panel styling | A product decision to change the cards' default brand colour |

## Found during the TypeScript migration

Strict typing flagged code that reads fields that don't exist, passes arguments nobody reads, or can only fail.

**Fixed.** These could only throw or never worked, and the intended field was obvious:

- **Clips search** read `item.content`, which clips don't have, so the first keystroke threw. It now searches `description`.
- **Posts search** threw on posts without text (`content` is null). It now skips them.
- **Banner, Professional Form and Products:** sorting by the name column read `a.user_profile`, which those rows don't have, so the click threw (audit item). Each now sorts by the name the column shows.
- **Orders search** read `item.orders_user`, but the customer is under `order_details_order`, so it never matched (audit item).
- **Order details drawer:** it requested `getOrderById/null` on page load. That request is now skipped until an order is picked.
- **Service Categories:** deleting a category called `getData()` without the table state, which threw inside its own try/catch, so the list never refreshed. It now passes the current table state.
- **Ads:** cropping a video for the "Journal Listing In-Feed 2" slot (no fixed height) always failed inside ffmpeg (`scale=600:null`). The dialog now says the slot has no fixed video size.
- **Access card details:** the business-hours list used `size="4px"`, which antd ignores. It is now `size={4}`.
- **Create Access Card:** `variant="bordered"` isn't a valid Card value; it is now `"outlined"`, with no visual change.

**Kept as-is, for the bug pass.** Behaviour is unchanged; the code is typed to match what it does today. (Oct 30: items that pass 9 fixed or pass 10 removed are taken off this list.)

- **Podcast schedules:** "get by id" and "delete" were called without the token, so they sent `Authorization: Bearer undefined`. Fixed in the security pass.
- **Parameters that never reach the API:** the `order` / `sortField` sent by the Users, Professionals, Clips, Service Categories and Appointments lists, and `limit` on Directory, Authors and Journal Categories. They were removed, so requests are unchanged.
- **Double fetching:** Edit Access Card fetches the card twice on load (`EditBusinessCard.tsx:357-361, 506-508`; Oct 30 audit, A-04).
- **Create Access Card** shares one city list across all locations, so picking a state for one location replaces the others' city options (`CreateBusinessCard.tsx:256`).
- **Login Activity:** the spinner never shows, because `loading` is never set to true (`LoginLogs.tsx:86`).

## The audit's suggested order, revisited

| Phase | Done | Still to do |
| --- | --- | --- |
| 1. Now | Credential logs removed; axios, dompurify and router upgraded; moment removed; keys disabled by the owner; `SafeHtml` for the 6 HTML sites; `noindex` | Nothing left in the panel |
| 2. This week | MUI removed; route groups decided (deleted); react-toastify, Font Awesome, Bootstrap JS and Popper removed; expired sessions cleared by a global handler; shared axios client, 401 handling and server auth confirmed (pass 9) | The last two broken-code rows (Specialities page, one missing key); catch-all 404 route |
| 3. Consolidate | antd only; dayjs, one icon set, one editor, chart.js, one cropper; one theme and palette | One date format |
| 4. Platform | Vite; React 19, antd 6, react-router 8 | `React.lazy` per route |

## Suggested next steps

First, deploy pass 11 once the backend's Nov 1 changes are live. Then follow the order in [Oct 30 audit](#oct-30-audit): fix first, then the platform safety net, backend requests, browser QA, consolidation, retirements and hygiene. Still to fit in from the earlier list:

- the last open rows of the broken-code table (Specialities page, one missing key) and the "kept as-is" items found during the TypeScript migration;
- after the date helper: tokens for font sizes, spacing and radii, which are still written per file;
- replace browser-image-compression;
- move Google Places to `PlaceAutocompleteElement` (it already loads on demand);
- turn on the oxlint rules that are off today.
