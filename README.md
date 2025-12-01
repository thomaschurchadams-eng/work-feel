# CreditUnionAI.fm Static Site

A responsive, multi-page static site for **CreditUnionAI.fm** with shared navigation, footer, and consistent styling across Home, News, Episodes, Insights, Newsletter, and About pages.

## Preview locally

1. From the project root, start a lightweight server:
   ```bash
   python3 -m http.server 8000
   ```
2. Open http://localhost:8000/ in your browser.
3. Navigate between pages using the top nav (mobile users can toggle the hamburger menu).

Stop the server with `Ctrl+C` when you are done.

## File map
- `index.html` — Home hero, latest news highlights, latest episode card, and mission statement
- `news.html` — News feed with curated cards and optional tag filter UI (placeholder)
- `episodes.html` — Podcast episode cards with durations and play buttons (UI only)
- `insights.html` — Insight/article cards with tags and links
- `newsletter.html` — Signup form with inline “Subscribed!” confirmation message
- `about.html` — What we do, who it’s for, and how it works overview
- `assets/styles.css` — Shared styling, layout, typography, and responsive behavior
- `assets/app.js` — Mobile nav toggle, active link highlighting, and newsletter submit handler
