# FilmUp

Every cinema in Lahore and every showtime, on one dark, cinematic map — with an AI concierge that knows the whole week's schedule.

**Stack:** React 19 · Vite · TypeScript · Tailwind CSS v4 · Framer Motion · MapLibre GL via react-map-gl (OpenFreeMap vector tiles, no API key) · Netlify Functions

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173 — everything except the chatbot
```

To run the chatbot locally you need the Netlify CLI, which serves the function next to Vite:

```bash
npm install -g netlify-cli
cp .env.example .env   # then put your real key in .env
netlify dev            # http://localhost:8888 — app + /.netlify/functions/chat
```

Other scripts: `npm run build` (typecheck + production build), `npm run typecheck`, `npm run preview`.

---

## Project structure

```
├── netlify.toml                  build, functions dir, SPA redirect, asset caching
├── .env.example                  AI_PROVIDER / AI_API_KEY / AI_MODEL
├── VERIFY_CINEMAS.md             research notes: which cinemas are confirmed, uncertain or excluded
├── netlify/functions/chat.ts     server-side AI proxy (the only place the key is read)
├── netlify/lib/rateLimit.ts      per-IP limiter used by the chat function
├── public/posters/*.svg          poster art for the demo films
└── src/
    ├── data/                     cinemas.json · movies.json · showtimes.json · areas.json
    ├── types/index.ts            Cinema, Movie, Showtime, Filters …
    ├── services/
    │   ├── dataSource.ts         ← the only module that knows where data comes from
    │   └── chatService.ts        calls /.netlify/functions/chat
    ├── lib/
    │   ├── schedule.ts           date/time + filtering logic (shared with the function)
    │   └── geo.ts                distance, Google Maps directions link
    ├── hooks/                    useCinemaData · useGeolocation · useMediaQuery · useNow
    └── components/
        Map · CinemaPanel · MovieCard · ShowtimeChips · SearchBar · Filters
        NowShowing · CinemaList · ChatBot · DateSelector · NearMeButton · Poster · Intro · Toast
```

---

## The 3D map

`src/components/Map.tsx` renders MapLibre GL with OpenFreeMap's `dark` style. At load time it re-colours that style warmer and adds a `fill-extrusion` layer for buildings. Many Lahore buildings have no height in OpenStreetMap, so they get a 9 m minimum.

- **Cinemas** are drawn twice. A 3D light beam (an extruded circle, gold normally, red when selected, grey when filtered out) stands among the buildings. A pulsing HTML pin floats above it, with a name label from zoom 12.5.
- **Clustering** uses `supercluster` on the HTML pins and is recomputed every half zoom level, so panning stays cheap on phones. Pixel ratio is capped at 2.
- **Camera:** the intro swoops into Gulberg at about 66° pitch, then pulls back to show every beam. Selecting a cinema flies there with pitch and a 40° bearing swing, and the catalog panel opens when the camera arrives.
- **Controls** (right edge): zoom, compass (click to reset north), 2D/3D toggle and reset view. You can also right-drag or two-finger-drag to rotate and tilt.

The camera API (`flyToCinema`, `flyToPoint`, `fitPoints`, `resetView`) is exposed through a ref, so `App.tsx` decides when the camera moves.

## Intro video

On the first visit in a browser session, `index.html` itself starts `/intro/intro-720.mp4`, before the JS bundle loads, so playback begins at once. React then adopts that element, fades into the map (opacity only, 0.5 s), and the map is created only after the intro ends. The intro is skipped on reloads in the same session (`sessionStorage`) and for reduced-motion users. The video is H.264 for everyone, because it's hardware-decoded on Macs; VP9 often isn't. It plays muted with a "Tap for sound" toggle (shown only if the audio isn't near-silent), a Skip button and a thin progress line. A poster frame shows while it loads. If there is no manifest, the video errors, autoplay is refused, or playback hasn't started within 4 s, it falls back to the FilmUp title card.

To replace the footage (needs `ffmpeg` on PATH):

```bash
npm run intro -- "path/to/master.mp4"                 # landscape 720p mobile version
npm run intro -- "path/to/master.mp4" --mobile-crop   # 720x1280 centre crop for phones
```

This writes desktop 1080p H.264 and VP9 files (sized to about 5 MB), mobile 720p versions (about 2.5 MB), the posters and the manifest into `public/intro/`. No code changes are needed. Keep the master file out of git: root-level video files are already in `.gitignore`.

**Only use footage you have the rights to.** Third-party studio intros (for example Marvel Studios') are copyrighted and trademarked, and can't be used on a commercial site.

## Search modes

The toggle in the search bar switches between two modes:

- **Movie:** autocomplete over films. Picking one dims every cinema not showing it on the selected date, and shows upcoming times over the matching pins. The results list shows that film's showtimes at each cinema. Clicking a result flies there and opens the catalog.
- **Location:** autocomplete over Lahore areas (`src/data/areas.json`, including aliases such as "Defence" or "Regal Chowk") and cinema names. Picking an area flies to it, drops a marker and sorts the list by distance from it. Picking a cinema flies straight to it.

*Near me* sorts by distance from your GPS position instead.

---

## Editing cinemas, films and showtimes

All data lives in `src/data/`. Edit the JSON and save — Vite hot-reloads it, and the chatbot reads the same files.

### `cinemas.json`

```json
{
  "id": "cinepax-packages-mall",    // unique, used by showtimes
  "name": "Cinepax Packages Mall",
  "address": "Packages Mall, Walton Road",
  "city": "Lahore",
  "area": "Walton",                 // neighbourhood: used by search and the chatbot
  "lat": 31.47141,
  "lng": 74.35704,
  "image": "https://…",             // hero photo in the detail panel
  "rating": 4.5,                    // 0–5
  "phone": "+92 42 111 246 372",    // "" if unknown: hides the Call button
  "screens": 10,                    // optional
  "verified": true,                 // false shows a "call ahead" notice
  "features": ["4DX", "Dolby Atmos"]   // optional
}
```

The 9 cinemas are real Lahore venues, researched in October 2026. **Read `VERIFY_CINEMAS.md` before launch.** It lists the three uncertain entries (including one estimated coordinate), the venues excluded as closed, and sources. To get coordinates, right-click the spot in Google Maps; the first item in the menu is `lat, lng`.

`areas.json` holds the neighbourhoods for location search (`id`, `name`, `aliases`, `lat`, `lng`). Add aliases for spellings people actually type.

### `movies.json`

```json
{
  "id": "iron-monsoon",
  "title": "Iron Monsoon",
  "poster": "/posters/iron-monsoon.svg",   // any URL, or a file in /public
  "genre": ["Action", "Thriller"],         // drives the genre filter
  "duration": 128,                          // minutes
  "language": "English",
  "rating": "PG-13",                        // age rating
  "synopsis": "…"
}
```

### `showtimes.json`

One entry per cinema, per film, per day:

```json
{ "cinemaId": "cinepax-packages-mall", "movieId": "iron-monsoon", "date": "2026-10-26", "times": ["14:30", "18:00", "21:45"] }
```

- `times` use 24-hour `HH:mm`. The UI shows them as `2:30 PM`.
- `date` can be an **ISO date** (`"2026-10-26"`) for real schedules, or a **relative offset** (`"+0"` today, `"+1"` tomorrow … `"+6"`). The demo data uses offsets, so it never goes stale.
- Entries that reference an unknown `cinemaId`/`movieId` are skipped. Duplicate entries for the same cinema, film and day are merged.

The UI shows today plus the next 6 days, and the chatbot sees the same 7 days.

### Moving to an API or admin panel

Components never import the JSON directly. They get data from `useCinemaData()`, which calls `dataSource.load()` in `src/services/dataSource.ts`. You have two options:

1. **No code changes.** Set `VITE_DATA_API_URL=https://your-api.example.com`, and the app will fetch `GET /cinemas`, `/movies` and `/showtimes` (same shapes as the JSON).
2. **Custom source.** Implement `CinemaDataSource` (one `load()` method) for Supabase, Firebase, a CMS and so on, and export it as `dataSource`.

If you do this, also change the three JSON imports at the top of `netlify/functions/chat.ts` to fetch from the same source, so the chatbot keeps seeing the live schedule.

---

## AI chatbot

The browser only ever calls `POST /.netlify/functions/chat`. The function:

1. reads `AI_PROVIDER`, `AI_API_KEY` and an optional `AI_MODEL` from the server environment;
2. builds a system prompt containing every cinema, every film, and all showtimes for the next 7 days. It also includes the user's local date and time, and their distances if they used *Near me*;
3. calls the provider with plain `fetch` (no SDKs) and returns `{ reply }`.

Incoming requests are checked before any provider call:

- **Rate limit:** 6 requests a minute and 40 an hour per IP (`429` with `Retry-After`). Tune these in `chat.ts`.
- **Length:** the new message can be at most **500 characters** (`413`), matching the chat box's limit. Earlier turns are trimmed to 2,000 characters, at most 12 messages are kept, and the body is capped at 32 KB.
- **Roles:** only `user` and `assistant`, and the conversation must end on a user message.

The function also returns friendly errors for a missing key and for provider outages.

| `AI_PROVIDER` | Default model (override with `AI_MODEL`) | Get a key |
| --- | --- | --- |
| `anthropic` (default) | `claude-haiku-5-5` | console.anthropic.com |
| `openai` | `gpt-4.1-mini` | platform.openai.com |
| `gemini` | `gemini-2.5-flash` | aistudio.google.com |

The Anthropic call uses low effort (fast, cheap replies are enough for showtime Q&A). If you set `AI_MODEL` to a model that supports Anthropic's server-side refusal fallback (Opus 5 / 5.5, Sonnet 5.5, Fable), the function enables it automatically. Haiku doesn't support it.

> ⚠️ Never put the key in a `VITE_`-prefixed variable. Vite inlines those into the public JavaScript bundle.

### Setting the key on Netlify

1. Push this repo to GitHub, GitLab or Bitbucket, then in Netlify choose **Add new site → Import an existing project**. The build settings come from `netlify.toml` (`npm run build` → `dist`).
2. Go to **Site configuration → Environment variables → Add a variable** and add:
   - `AI_PROVIDER` = `anthropic` (or `openai` / `gemini`)
   - `AI_API_KEY` = your secret key. Mark it **secret** and give it the **Functions** scope.
   - `AI_MODEL` (optional)
3. **Deploys → Trigger deploy → Deploy site.** Environment changes only apply after a new deploy.

Or with the CLI:

```bash
netlify env:set AI_PROVIDER anthropic
netlify env:set AI_API_KEY sk-... --secret
netlify deploy --prod
```

**Limits of the built-in rate limiter:** it keeps counts in function memory, so each warm instance has its own counter, and a cold start resets it. That stops bursts and casual abuse. For hard limits under real traffic, move the counter to Netlify Blobs or Upstash Redis (`netlify/lib/rateLimit.ts` has a small interface to swap). Also set a monthly spending cap with your AI provider.

---

## Design notes

- **Palette:** ink blacks (`ink-950 #07070a` → `ink-600`), warm gold accent (`gold-400 #f5c26b`) and ember red (`#ff3b4e`) for the selected cinema and the next show. All are defined as Tailwind theme tokens in `src/index.css`.
- **Type:** Bebas Neue for display headings, Manrope for body text.
- **Texture:** an animated SVG film-grain overlay and a vignette over the map, plus warm sky and fog on the horizon at high pitch.
- **Motion:** an intro title card, staggered entrance of the UI, spring-driven panels and sheets, staggered film lists, and a shared-layout date pill. The grain animation turns off for `prefers-reduced-motion`.
- **Mobile:** the detail panel and cinema list become drag-to-dismiss bottom sheets, filters scroll horizontally, and the dock keeps the list and chat buttons within thumb reach.

Cinemas are real. **Films, posters, showtimes and ratings are demo data**, and cinema photos are generic Unsplash images. Replace them with the cinemas' own listings and photos (with permission) before launch.
