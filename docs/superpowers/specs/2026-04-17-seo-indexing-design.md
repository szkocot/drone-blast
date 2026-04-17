# SEO & Indexing Design

**Date:** 2026-04-17
**Status:** Approved

## Problem

`droneblast.ovh` is a client-rendered Svelte/Vite PWA. The initial HTML shell currently contains almost no crawlable product content beyond a generic title and PWA tags. On load, the app immediately requests geolocation and weather data; when that fails, the first meaningful rendered text can become:

`Could not load forecast — check your connection. Retry`

That makes two problems likely:

- Google has weak static signals for what the product is and who it is for.
- Google can index transient runtime error text as the most visible page content for brand searches like `droneblast.ovh`.

## Goals

- Keep the site app-first at `/` with no separate marketing landing page.
- Improve indexing for both brand and non-brand queries.
- Support bilingual discovery for English and Polish on the same page.
- Give crawlers deterministic, high-signal content before JavaScript runs.
- Reduce the chance that transient forecast error UI becomes the indexed snippet.

## Non-Goals

- Migrating to SSR or prerendered routes.
- Moving the forecast app to `/app`.
- Adding a visible marketing hero or changing the startup UX substantially.
- User-agent cloaking or bot-specific rendered content.

---

## Architecture

### 1. Strengthen the static HTML shell

The root `index.html` becomes the primary SEO surface for the app.

Add:

- specific `<title>`
- non-generic meta description
- canonical URL
- Open Graph tags
- Twitter card tags
- `hreflang` links for `en`, `pl`, and `x-default`
- structured data describing the product as a weather/utility software application

The shell stays visually app-first. SEO content is present in the DOM before hydration, but not displayed in the main UI.

### 2. Add hidden but indexable bilingual content

Add one hidden SEO block to `index.html` that is:

- present in server-delivered HTML
- not `display: none`
- not `hidden` or `aria-hidden`
- visually clipped off-screen using a standard screen-reader-only pattern

This block should contain:

- one concise English paragraph
- one concise Polish paragraph
- one compact feature list

The copy should naturally cover the intended discovery terms without reading like a keyword dump.

### 3. Make the app bootstrap less snippet-hostile

The current app can render a full-screen failure state whose main text is the generic network error. That state is valid for users, but it should not be the only substantial text on the page.

The fix is not bot detection. The fix is:

- strong static product copy already present in HTML
- metadata that describes the product clearly
- a less dominant relationship between runtime error text and the total document content

If needed, the runtime error copy may be softened, but the main protection comes from the HTML shell rather than from hiding or delaying real errors.

---

## Metadata Strategy

### Title

Use a title that covers both brand and non-brand intent.

Target shape:

`Drone Blast - FPV Wind Forecast App | Prognoza Wiatru FPV`

This keeps the brand first while also describing the product clearly.

### Description

Use one bilingual description that is readable to humans and specific enough for search.

Target shape:

`Drone Blast is a wind forecast app for FPV drone pilots with a 7-day wind map, altitude-based forecast, gusts, and Kp index. Aplikacja pogodowa dla pilotow FPV z prognoza wiatru i mapa warunkow lotu.`

ASCII-only Polish is acceptable in metadata if needed for consistency, but standard Polish diacritics are preferred when the file already supports UTF-8.

### Canonical and language hints

Add:

- canonical `https://droneblast.ovh/`
- `link rel="alternate" hreflang="en" href="https://droneblast.ovh/"`
- `link rel="alternate" hreflang="pl" href="https://droneblast.ovh/"`
- `link rel="alternate" hreflang="x-default" href="https://droneblast.ovh/"`

This is a single-page bilingual document, not separate language routes.

### Social preview tags

Add Open Graph and Twitter tags using the same core positioning:

- product name
- concise description
- site URL
- preview image, if an existing branded asset is suitable

If there is no suitable social card image in the repo, metadata can ship first without one. This should not block the rest of the SEO work.

### Structured data

Add one JSON-LD block in `index.html`.

Preferred shape:

- `WebSite`
- `SoftwareApplication`

`SoftwareApplication` should include:

- name
- application category
- operating system (`Web`, `Android`, `iOS`)
- description
- URL
- offers: free

Do not invent ratings, reviews, or organization data that cannot be supported.

---

## Hidden SEO Copy

### Copy goals

The hidden content should answer:

- what Drone Blast is
- who it is for
- what makes it useful
- which search intents it should satisfy

### English paragraph

Should cover:

- FPV drone pilots
- wind forecast app
- 7-day forecast
- altitude-aware wind view
- gusts / Kp / flight planning context

### Polish paragraph

Should cover the Polish equivalent intent:

- prognoza wiatru FPV
- pogoda dla dronow
- warunki lotu dla pilotow FPV

### Feature list

Keep it short and factual. Example categories:

- 7-day wind forecast
- altitude layers for drone flying
- wind map and gusts
- Kp index for planning
- mobile PWA installability

The copy must stay concise. The goal is crawlable relevance, not a hidden landing page.

---

## Runtime Error Handling

### Current issue

`src/App.svelte` renders a full-screen loading state, then a full-screen failure state if too few weather models succeed. For crawlers or users without working geolocation/network access, this can dominate the visible DOM.

### Intended behavior

Keep the visible UX broadly the same for humans, but ensure the document still has strong static product content even when the app fails to load live forecast data.

### Optional copy adjustment

If the error string is still too snippet-prone after the HTML improvements, update the generic failure wording to be more neutral and product-aware, for example:

- `Live forecast unavailable right now. Check your connection and try again.`

This is optional and secondary. The core fix is stronger HTML content.

---

## Indexing Assets

### `robots.txt`

Add `public/robots.txt` with:

- allow root crawl
- sitemap location

Target shape:

```text
User-agent: *
Allow: /

Sitemap: https://droneblast.ovh/sitemap.xml
```

### `sitemap.xml`

Add `public/sitemap.xml` for the current single-page surface.

Include:

- root URL
- last modification date if convenient to maintain

This can stay minimal until the site has more crawlable routes.

---

## File Changes

| File | Change |
|------|--------|
| `index.html` | Add metadata, canonical, hreflang, JSON-LD, hidden bilingual SEO block |
| `src/App.svelte` | Optionally soften error copy or adjust startup failure presentation if needed |
| `src/lib/i18n/en.ts` | Optional error copy update |
| `src/lib/i18n/pl.ts` | Optional Polish error copy update |
| `public/robots.txt` | New |
| `public/sitemap.xml` | New |

---

## Testing

### Manual checks

- View page source and confirm metadata, JSON-LD, canonical, and hidden copy are present before JS execution.
- Confirm the app still boots normally and the hidden SEO block is not visually exposed.
- Confirm `robots.txt` and `sitemap.xml` resolve from production paths.
- Validate that the bilingual copy reads naturally in both languages.

### Search-console / crawler checks

After deployment:

- request re-indexing in Google Search Console if available
- inspect the live URL and rendered HTML
- confirm Google no longer surfaces the forecast error as the dominant snippet over time

### Regression checks

- ensure no PWA manifest or icon references regress
- ensure hidden content does not interfere with layout, accessibility, or app hydration

---

## Success Criteria

- The root HTML clearly describes Drone Blast before JavaScript runs.
- Google has stable brand and non-brand text to index in both English and Polish.
- The forecast connection error is no longer the strongest page-level search snippet candidate.
- The app remains visually app-first for users.
