# Posting workflow (for Ween’s Projects)

This blog is intentionally zero-build.
A post is a single HTML file under `posts/` that contains a `<script type="text/markdown" id="post-markdown">` block.
The page JS renders that markdown on load.

## Where things live

- Home page: `index.html`
- About page: `about.html`
- Posts:
  - HTML files: `posts/*.html`
  - Manifest: `posts/manifest.json`
- Assets:
  - CSS: `assets/css/styles.css`
  - JS: `assets/js/site.js`, `assets/js/post.js`
  - Images: `assets/images/*`

## Naming convention (recommended)

Use a slug + the date:

- `posts/<title-slug>-DD.MM.YY.html`

Example:

- `posts/vee-blocks-resin-suction-forces-and-logging-10.02.26.html`

Why: URL-friendly, unique, and keeps your preferred `DD.MM.YY` date style.
(If you ever want natural sorting by filename, switch to `YYYY-MM-DD-title-slug.html`.)

## Creating a new post (checklist)

1) Create a new HTML file in `posts/` by copying the latest post file.

2) Update these bits in the new file:
- `<meta name="post:slug" content="...">` → set to the new filename
- The markdown inside `#post-markdown`
- The tag pills in the header (we currently hardcode these pills):
  - date (e.g. `10.02.26`)
  - topic tags (e.g. `Vee Blocks`, `Resin Suction Sim`)

3) Add images to:
- `assets/images/`

…and reference them in the post markdown like:

- `![alt text](../assets/images/your-image.jpg)`

4) Update `posts/manifest.json` (TOP = NEWEST):

```json
{
  "title": "Ween’s Projects",
  "posts": [
    {
      "title": "Your Post Title",
      "date": "DD.MM.YY",
      "path": "posts/your-slug-DD.MM.YY.html"
    }
  ]
}
```

5) Commit + push.

## WhatsApp “new post” input format (what to send Michael)

Send:

1) One long message containing:
- Post title
- Date
- Tags
- Body (with headings + bullets as you like)
- Image notes like `[photo 1 here: ...]` where you want images inserted

2) Then send images (in order).

Michael will:
- pick filenames under `assets/images/` that match the post
- replace placeholders with the correct `../assets/images/...` links
- update the manifest
- commit + push
