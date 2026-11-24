# Glamlink Admin Panel

Admin panel for the Glamlink website (glamlink.net): professionals, brands and their public pages, Access cards (requests, orders, pricing, subscriptions), the directory, its applications and its listing claims, the journal, magazine, videos and podcast, ads, the home page, and what the website's forms collect.

The website comes first. The mobile app's screens (app users, posts, clips, followers, bookings, services, shop products and orders, referrals and rewards, banners and app FAQs) were removed until the app is rebuilt; they are in git history at `2970239`. What the panel must do for the new API is in the backend's `docs/handoff/admin-panel.md`. Work done against the code audits, open findings and next steps are in `progress.md`.

## Stack

| Job | Library |
| --- | --- |
| Language | [TypeScript](https://www.typescriptlang.org) (strict); `tsc` type-checks, Vite transpiles |
| Build & dev server | [Vite](https://vite.dev) |
| UI components, icons, notifications | [antd](https://ant.design) + `@ant-design/icons` |
| Routing | [React Router](https://reactrouter.com) v8 (`react-router`) |
| Rich-text editor | [Tiptap](https://tiptap.dev) — shared `src/components/RichTextEditor.tsx` (`simple`, `full`, and `article` for profile Education posts) |
| Charts | Chart.js (`react-chartjs-2`) |
| Dates | dayjs |
| Image cropping | `antd-img-crop` (fixed ratios): wrapped by `src/components/ImageCropModal.tsx` on the card forms and by `src/components/ImageUploadField.tsx` on the newer screens; older pages use it directly. `react-image-crop` for the free crop: `src/components/ImageCropDialog.tsx` (presets, Free, a custom ratio, rotation) on the Journal's cover, author photos and pictures in the text |
| Tests | [Vitest](https://vitest.dev) + Testing Library (jsdom) |
| Lint | [oxlint](https://oxc.rs/docs/guide/usage/linter) |

## Getting started

Requires Node `^22.22.2` or `>=24.15.0`.

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:3000
```

### Environment variables

Read at build time from `.env` (see `.env.example`). Only variables prefixed with `VITE_` reach the app; restart the dev server after changing them. A new variable must also be declared in `src/vite-env.d.ts`, or reading it is a type error.

| Variable | Used for |
| --- | --- |
| `VITE_API_BASE_URL` | Backend API base URL (ends with `/`); production: `https://api.glamlink.net/api/v1/` |
| `VITE_IMAGE_BASE_URL` | Base URL for uploaded images, read only by two older screens (View Professional, Applicant Form) to turn file names into links; the new API returns full URLs. Production: `https://api.glamlink.net/images/` |
| `VITE_VIDEO_BASE_URL` | Not read by any screen (only `src/services/Host.ts` re-exports it, and nothing imports that). `src/config/env.ts` still requires it, so keep it set until it is removed. Production: `https://api.glamlink.net/videos/` |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps address search and geocoding on the access card forms; the script loads on first use (`src/utils/googleMaps.ts`) |
| `VITE_WEBSITE_URL` | Optional. The public website, for "view on site" links (`src/utils/website.ts`); defaults to `https://glamlink.net` |

The API only answers browsers on origins it lists (`ACCESSDOMAINS` in the API's `.env` on the server). On Nov 22, 2026 the live API listed `https://admin.glamlink.net` and `http://localhost:3000`, so `npm run dev` with the production values above works against it; a port it doesn't list is refused (`http://localhost:3001` got 403 `ORIGIN_NOT_ALLOWED`), which is why the dev server never moves off port 3000 (`strictPort` in `vite.config.ts`). Check from a terminal: `curl -sI -H 'Origin: http://localhost:3000' https://api.glamlink.net/api/v1/access/plans | grep -i access-control-allow-origin`. Since Nov 5, api.glamlink.net is the live API: what you do from a local panel is real (customer data, Stripe, Shippo labels, emails). If the Maps key is restricted to admin.glamlink.net, as `.env.example` intends, address search on the card forms fails locally unless `http://localhost:3000/*` is added to its allowed referrers.

Every request carries the admin token through one shared client (`src/utils/session.ts`); API functions don't set auth headers themselves.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` (or `npm start`) | Dev server with hot reload on port 3000 |
| `npm run build` | Type-check, then production build into `build/` (fails on any type error) |
| `npm run typecheck` | Type-check only (`tsc`, no output files) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Re-run tests on change |
| `npm run lint` | Lint with oxlint (rules in `.oxlintrc.json`) |

The ad video cropper uses the browser's own encoder (WebCodecs, through Mediabunny), so admins need a current Chrome, Edge, Safari or Firefox to crop videos.

The live panel is admin.glamlink.net. This repo holds no CI or hosting config; the deploy scripts that `vite.config.ts` mentions live outside it.

## Project layout

```
index.html                Vite entry (loads src/index.tsx)
src/
  App.tsx                 Routes, and redirects from old addresses
  paths.ts                Every screen's address (routes, sidebar and links read it), and the old addresses that moved
  components/             Shared components: layout and the sidebar's groups (sidebarMenu.tsx), rich-text editor, image cropper, SafeHtml (stored HTML
                          through DOMPurify), DeleteConfirmButton, and for the newer screens
                          PageHeader/Panel, AccountSelect (pick professional and brand accounts),
                          ImageUploadField (upload an image, keep its link), DateRangeFilter
  config/                 Environment, dayjs and the antd theme (built from index.css)
  index.css               The only global stylesheet; every colour token lives here
  pages/                  One folder per admin section; BusinessCard/cardType.ts holds a card's type
                          (Professional or Brand: labels, tag colours, options) for the card screens
  services/Api/           API calls, one module per backend area, typed with the models in types/
  types/                  API response shapes and domain models (users, journals, access cards, …)
  utils/                  Shared helpers: API error readers, showFieldError (a refusal's details.field on its
                          form field), table state, :id route param, CSV export, website links, badges (a
                          screen asks the sidebar to recount its badges); also one component,
                          LocationAutocomplete.tsx (Google Places address search)
  setupTests.ts           Vitest setup (jest-dom matchers, jsdom shims)
  vite-env.d.ts           Types for the VITE_* environment variables
```

Tests live next to the code they cover (`*.test.ts` / `*.test.tsx`). The newer screens and the shared helpers have tests; most older screens have none yet (see `progress.md`).

## Colours

Every colour is a token in `src/index.css` (`--color-primary`, `--color-text`, `--color-surface`, …). Use them as `var(--color-…)` in CSS, SCSS and inline styles. The antd theme reads the same tokens (`src/config/theme.ts`), so antd components and preset tag colours (`<Tag color="green">`) follow them automatically. Charts draw on a canvas and can't use `var()`; read tokens there with `cssVar("--color-…")`.

`src/theme.test.ts` fails on any hex, `rgb()` or `hsl()` colour outside `index.css`. If a value is data rather than styling (e.g. a brand colour saved with an access card), mark its line `// color-literal-ok: <reason>`.

The domain types in `src/types/` were inferred from how the pages use each response, not from a backend schema. Fields the code treats defensively (`?.`, fallbacks) are optional; when the API turns out to differ, fix the type there and let `npm run typecheck` show every page affected.
