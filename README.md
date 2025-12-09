# CreditUnionAI News Static Site

A responsive, multi-page static site for **CreditUnionAI News** with shared navigation, footer, and consistent styling across Home, News, Episodes, Insights, Newsletter, and About pages.

## Preview locally

Quickest path (uses Python, preinstalled on most systems):

1. From the project root, start a lightweight server:
   ```bash
   python3 -m http.server 8000
   ```
2. Open http://localhost:8000/ in your browser. You can click between `index.html`, `news.html`, `episodes.html`, `insights.html`, `newsletter.html`, and `about.html` from the nav bar.
3. Stop the server with `Ctrl+C` when finished.

If you prefer a different port, change `8000` above and open that port in the URL instead.

### Newsletter signup API (file-backed)

The newsletter form now posts to a lightweight Node server that stores submissions in `data/newsletter-signups.json`.

1. Set an admin key before starting the server: `export NEWSLETTER_ADMIN_KEY=your-secret-key`
2. Start the server: `node server.js` (serves the static site and `/api/newsletter` endpoints).
3. Load `/newsletter-log.html`, enter the same admin key, and use the **Load signups** button to view, export, or clear entries.

## File map
- `index.html` — Home hero, latest news highlights, latest episode card, and mission statement
- `news.html` — News feed with curated cards and optional tag filter UI (placeholder)
- `episodes.html` — Podcast episode cards with the embedded intro episode and placeholders for upcoming shows
- `insights.html` — Insight/article cards with tags and links
- `newsletter.html` — Signup form with inline “Subscribed!” confirmation message
- `about.html` — What we do, who it’s for, and how it works overview
- `assets/styles.css` — Shared styling, layout, typography, and responsive behavior
- `assets/app.js` — Mobile nav toggle, active link highlighting, and newsletter submit handler

## Audio
- The intro episode is streamed via Spotify embed (no local MP3 required). The embed is wired into `index.html` and the first card on `episodes.html`.
- No local audio assets are tracked in this repo; audio files should be hosted via Spotify or another streaming provider.
