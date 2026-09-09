# Posting workflow — Ween’s Projects

The deployed blog is static and readable without JavaScript. Each post keeps its editable Markdown source in `#post-markdown`; `npm run build` converts that source into semantic article HTML and generates metadata, navigation, the Atom feed and sitemap.

## Where things live

- Home: `index.html`
- About: `about.html`
- Posts: `posts/*.html`
- Generated post catalogue: `posts/manifest.json`
- Styles/scripts/images: `assets/`
- Publisher: `scripts/build.mjs`
- Tests: `tests/`

## Naming convention

Use `posts/<title-slug>-DD.MM.YY.html`, for example:

`posts/vee-blocks-resin-suction-forces-and-logging-10.02.26.html`

The build derives the ISO publication date from the filename and sorts posts newest-first.

## Creating a post

1. Copy a recent post HTML file to the new dated filename.
2. Replace the Markdown inside `<script type="text/markdown" id="post-markdown">`.
3. Ensure the first Markdown heading is the genuine post title. Use `##` for sections; the generated page title is the single page `h1`.
4. Add photographs to `assets/images/` and reference them with useful alt text:

   ```md
   ![What the image communicates](../assets/images/descriptive-name.jpg)
   ```

5. Do not publish photo placeholders. Either supply the real image and caption or remove the promise.
6. Run the complete publication gate:

   ```sh
   npm install
   npm run check
   npm audit --audit-level=high
   ```

7. Review the resulting diff. The build updates all post shells, `posts/manifest.json`, `index.html`, `about.html`, `feed.xml` and `sitemap.xml` deterministically.
8. Preview the home page and new post at desktop and mobile widths. Check the menu by keyboard, images, headings, links, previous/next navigation and no-JavaScript readability.
9. Commit and push only after the checks and preview pass.

## Editorial checks

- Treat personal measurements and machining trials as dated observations, not universal specifications or safety guarantees.
- State the tested software/game/device version when saying “current”.
- Qualify privacy, backup, price and service-limit claims; link authoritative documentation where useful.
- Keep dimensions explicit (`length × width × height`) rather than ambiguous square-unit notation.
- Preserve the candid first-person voice while clearly marking limitations and later corrections.

## WhatsApp input format

Send Michael:

1. Title, date, tags and body text with headings/bullets.
2. Image-placement notes and then the actual images in order.
3. Any dates, versions, measurements or safety qualifications that should accompany the post.

Michael can then prepare the source, run the build and tests, preview it, and ask for approval before any push.
