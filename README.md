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

## Sitemap

Search crawlers can discover site pages through `sitemap.xml` at the project root. When running locally, load http://localhost:8000/sitemap.xml to verify each section and content URL is listed.

## File map
- `index.html` — Home hero, latest news highlights, latest episode card, and mission statement
- `news.html` — News feed with curated cards and optional tag filter UI (placeholder)
- `episodes.html` — Podcast episode cards with durations and play buttons (UI only)
- `insights.html` — Insight/article cards with tags and links
- `newsletter.html` — Signup form with inline “Subscribed!” confirmation message
- `about.html` — What we do, who it’s for, and how it works overview
- `assets/styles.css` — Shared styling, layout, typography, and responsive behavior
- `assets/app.js` — Mobile nav toggle, active link highlighting, and newsletter submit handler
