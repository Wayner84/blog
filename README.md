# Ween’s Projects — Blog (GitHub Pages)

A simple static blog for logging creative projects with photos.

## Structure
- `index.html` — home + newest posts
- `about.html` — about page
- `posts/` — each post is a standalone HTML file: `posts/TITLE-DD.MM.YY.html`
- `posts/manifest.json` — list of posts in upload order (newest first)
- `assets/` — CSS/JS/images

## Add a new post
1. Copy `posts/example-post-10.02.26.html` and rename it to `posts/<title>-DD.MM.YY.html`
2. Edit the `<script type="text/markdown" id="post-markdown">` block.
3. Add the new entry to `posts/manifest.json` (top = newest).
4. Commit + push.

Markdown supports images:
```md
![alt text](../assets/images/my-photo.jpg)
```
