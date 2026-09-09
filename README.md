# Ween’s Projects — Blog

A static GitHub Pages blog for logging creative projects with photographs. Post pages contain build-generated semantic HTML, unique metadata and a preserved Markdown source block.

## Structure

- `index.html` — home and newest posts
- `about.html` — about page
- `posts/*.html` — published posts
- `posts/manifest.json` — generated, date-sorted post catalogue
- `assets/` — CSS, JavaScript and images
- `scripts/build.mjs` — deterministic static publication build
- `feed.xml` and `sitemap.xml` — generated discovery files
- `tests/` — publication and interaction checks

## Local verification

```sh
npm install
npm run check
npm audit --audit-level=high
```

`npm run check` builds all post pages, the index navigation, Atom feed and sitemap before running the complete test suite.

See `POSTING.md` for the publishing checklist.
