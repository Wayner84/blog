import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'posts');
const canonicalRoot = 'https://wayner84.github.io/blog/';
const read = (file) => readFile(path.join(root, file), 'utf8');
const write = (file, value) => writeFile(path.join(root, file), value.replace(/\r\n/g, '\n'), 'utf8');
const escapeAttr = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeXml = (value) => escapeHtml(value).replaceAll('"', '&quot;').replaceAll("'", '&apos;');

function sourceMarkdown(html, file) {
  const match = html.match(/<script type="text\/markdown" id="post-markdown">([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`${file}: missing #post-markdown source`);
  return match[1].trim();
}

function dimensionsOf(buffer, file) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + length + 2 > buffer.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += length + 2;
    }
  }
  const text = buffer.toString('utf8', 0, Math.min(buffer.length, 4096));
  const svg = text.match(/<svg\b[^>]*\b(?:viewBox="[^"]*?\s(\d+(?:\.\d+)?)\s(\d+(?:\.\d+)?)"|width="(\d+(?:\.\d+)?)"[^>]*height="(\d+(?:\.\d+)?)")/i);
  if (svg) return { width: Math.round(Number(svg[1] || svg[3])), height: Math.round(Number(svg[2] || svg[4])) };
  throw new Error(`${file}: unsupported image or missing dimensions`);
}

function isoDate(displayDate) {
  const match = displayDate.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!match) throw new Error(`Invalid post date: ${displayDate}`);
  return `20${match[3]}-${match[2]}-${match[1]}`;
}

function plainText(markdown) {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function descriptionFrom(markdown) {
  const paragraphs = markdown
    .replace(/^# .+\n+/, '')
    .split(/\n\s*\n/)
    .map((part) => plainText(part))
    .filter((part) => part && !/^(?:Photo placeholder|[-\d.)]+\s)/i.test(part));
  const text = (paragraphs.join(' ') || 'A project update from Ween’s Projects.').trim();
  if (text.length <= 158) return text;
  return `${text.slice(0, 155).replace(/\s+\S*$/, '')}…`;
}

function replaceOrInsert(html, start, end, content, anchor) {
  const block = `${start}\n${content}\n${end}`;
  const pattern = new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  if (pattern.test(html)) return html.replace(pattern, block);
  return html.replace(anchor, `$&\n${block}`);
}

async function imageAttributes(rendered, postPath) {
  let imageIndex = 0;
  const matches = [...rendered.matchAll(/<img src="([^"]+)" alt="([^"]*)">/g)];
  for (const match of matches) {
    const [tag, src, alt] = match;
    if (!src.startsWith('../assets/images/')) continue;
    const local = path.resolve(path.dirname(path.join(root, postPath)), src);
    const dimensions = dimensionsOf(await readFile(local), local);
    imageIndex += 1;
    const loading = imageIndex === 1 ? 'eager' : 'lazy';
    const priority = imageIndex === 1 ? ' fetchpriority="high"' : '';
    const enhanced = `<img src="${src}" alt="${alt}" width="${dimensions.width}" height="${dimensions.height}" loading="${loading}" decoding="async"${priority}>`;
    rendered = rendered.replace(tag, enhanced);
  }
  return rendered;
}

function navItems(posts, prefix, currentPath = '') {
  return posts.map((post) => {
    const current = post.path === currentPath ? ' aria-current="page"' : '';
    return `          <a class="nav-link" href="${prefix}${post.path}"${current}>\n            <div><div class="name">${escapeHtml(post.title)}</div><div class="meta"><time datetime="${post.published}">${post.date}</time></div></div>\n            <div class="meta" aria-hidden="true">→</div>\n          </a>`;
  }).join('\n');
}

function applySharedShell(html, posts, isPost, currentPath = '') {
  const prefix = isPost ? '../' : './';
  if (!html.includes('type="application/atom+xml"')) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, `$&\n  <link rel="alternate" type="application/atom+xml" title="Ween’s Projects feed" href="${prefix}feed.xml" />`);
  }
  if (!html.includes('class="skip-link"')) html = html.replace(/<body>\s*/, '<body>\n  <a class="skip-link" href="#main-content">Skip to main content</a>\n');
  html = html.replace(/<button class="hamburger" id="hamburger"[^>]*>/, '<button class="hamburger" id="hamburger" aria-controls="drawer" aria-expanded="false" aria-label="Open menu">');
  html = html.replace(/<div class="drawer-backdrop" id="drawer-backdrop"[^>]*><\/div>/, '<div class="drawer-backdrop" id="drawer-backdrop" aria-hidden="true" hidden></div>');
  html = html.replace(/<aside class="drawer" id="drawer"[^>]*>/, '<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="Site menu" hidden>');
  html = html.replace(/<main class="container"(?: id="main-content")?>/, '<main class="container" id="main-content" tabindex="-1">');
  html = html.replace(/<div id="drawer-posts">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/aside>/, `<div id="drawer-posts">\n${navItems(posts, prefix, currentPath)}\n        </div>\n      </div>\n    </div>\n  </aside>`);
  if (currentPath === 'about.html') {
    html = html.replace(/<a class="nav-link" href="\.\/about\.html"(?: aria-current="page")?>/, '<a class="nav-link" href="./about.html" aria-current="page">');
  } else {
    html = html.replace(/<a class="nav-link" href="\.\/about\.html" aria-current="page">/, '<a class="nav-link" href="./about.html">');
  }
  return html;
}

function applySharedMetadata(html, page) {
  const details = page === 'index.html'
    ? { title: 'Ween’s Projects', description: 'Wayne’s project scrapbook covering practical engineering, machining, 3D printing, software and workshop experiments.', canonical: canonicalRoot }
    : { title: 'About — Ween’s Projects', description: 'About Wayne, the engineer and maker behind Ween’s Projects.', canonical: `${canonicalRoot}about.html` };
  const metadata = [
    `  <meta name="description" content="${escapeAttr(details.description)}" />`,
    `  <link rel="canonical" href="${details.canonical}" />`,
    '  <meta property="og:type" content="website" />',
    `  <meta property="og:title" content="${escapeAttr(details.title)}" />`,
    `  <meta property="og:description" content="${escapeAttr(details.description)}" />`,
    `  <meta property="og:url" content="${details.canonical}" />`,
    '  <meta name="twitter:card" content="summary" />',
    `  <meta name="twitter:title" content="${escapeAttr(details.title)}" />`,
    `  <meta name="twitter:description" content="${escapeAttr(details.description)}" />`
  ].join('\n');
  return replaceOrInsert(html, '<!-- generated:shared-metadata:start -->', '<!-- generated:shared-metadata:end -->', metadata, /<title>[^<]+<\/title>/);
}

const originalManifest = JSON.parse(await read('posts/manifest.json'));
const files = (await readdir(postsDir)).filter((name) => name.endsWith('.html'));
const existingByFile = new Map(originalManifest.posts.map((post, index) => [path.basename(post.path), { ...post, order: index }]));
const sources = new Map();

for (const file of files) {
  const postPath = `posts/${file}`;
  const html = await read(postPath);
  const markdown = sourceMarkdown(html, postPath);
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const date = file.match(/-(\d{2}\.\d{2}\.\d{2})\.html$/)?.[1];
  if (!title || !date) throw new Error(`${postPath}: title/date cannot be derived`);
  sources.set(file, { html, markdown });
  const old = existingByFile.get(file);
  existingByFile.set(file, {
    title,
    date,
    published: isoDate(date),
    description: descriptionFrom(markdown),
    path: postPath,
    order: old?.order ?? (title === 'MUFT upgrade' ? 10.5 : 999)
  });
}

const posts = [...existingByFile.values()]
  .filter((post) => files.includes(path.basename(post.path)))
  .sort((a, b) => b.published.localeCompare(a.published) || a.order - b.order)
  .map(({ order, ...post }) => post);

await write('posts/manifest.json', `${JSON.stringify({ title: originalManifest.title, posts }, null, 2)}\n`);

for (let index = 0; index < posts.length; index += 1) {
  const post = posts[index];
  const file = path.basename(post.path);
  const { markdown } = sources.get(file);
  let html = sources.get(file).html;
  const bodyMarkdown = markdown.replace(/^\s*#\s+.+\n+/, '');
  let rendered = await imageAttributes(await marked.parse(bodyMarkdown, { gfm: true }), post.path);
  const firstImage = rendered.match(/<img src="\.\.\/assets\/images\/([^"]+)"/)?.[1];
  const socialImage = firstImage ? `${canonicalRoot}assets/images/${firstImage}` : `${canonicalRoot}assets/images/social-card.png`;
  const canonical = `${canonicalRoot}${post.path}`;
  const metadata = [
    `  <meta name="description" content="${escapeAttr(post.description)}" />`,
    `  <link rel="canonical" href="${canonical}" />`,
    `  <meta property="og:type" content="article" />`,
    `  <meta property="og:title" content="${escapeAttr(post.title)}" />`,
    `  <meta property="og:description" content="${escapeAttr(post.description)}" />`,
    `  <meta property="og:url" content="${canonical}" />`,
    `  <meta property="og:image" content="${socialImage}" />`,
    `  <meta property="article:published_time" content="${post.published}" />`,
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:title" content="${escapeAttr(post.title)}" />`,
    `  <meta name="twitter:description" content="${escapeAttr(post.description)}" />`,
    `  <meta name="twitter:image" content="${socialImage}" />`
  ].join('\n');

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(post.title)} — Ween’s Projects</title>`);
  html = html.replace(/<meta name="post:slug" content="[^"]+" \/>/, `<meta name="post:slug" content="${escapeAttr(file)}" />`);
  html = replaceOrInsert(html, '<!-- generated:post-metadata:start -->', '<!-- generated:post-metadata:end -->', metadata, /<title>[^<]+<\/title>/);
  html = html.replace(/\s*<!-- Markdown renderer \(CDN\) -->\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/marked\/marked\.min\.js"><\/script>/, '');
  html = html.replace(/<h1 class="post-title" id="post-title">[\s\S]*?<\/h1>/, `<h1 class="post-title" id="post-title">${escapeHtml(post.title)}</h1>`);
  html = html.replace(/<div class="post-meta">[\s\S]*?<\/div>\s*\n\s*<div class="markdown" id="post-content">[\s\S]*?<\/div>/, `<div class="post-meta">\n          <time class="pill" id="post-date" datetime="${post.published}">${post.date}</time>\n        </div>\n\n        <div class="markdown" id="post-content">\n${rendered.trim()}\n        </div>`);

  const older = posts[index + 1];
  const newer = posts[index - 1];
  const prev = older ? `<a class="btn" id="btn-prev" href="../${older.path}"><span aria-hidden="true">←</span> <span data-label>Previous</span></a>` : '<span class="btn" id="btn-prev" aria-disabled="true"><span aria-hidden="true">←</span> <span data-label>Previous</span></span>';
  const next = newer ? `<a class="btn" id="btn-next" href="../${newer.path}"><span data-label>Next</span> <span aria-hidden="true">→</span></a>` : '<span class="btn" id="btn-next" aria-disabled="true"><span data-label>Next</span> <span aria-hidden="true">→</span></span>';
  html = html.replace(/<div class="footer-nav">[\s\S]*?<\/div>\s*<\/article>/, `<div class="footer-nav">\n        ${prev}\n        ${next}\n      </div>\n    </article>`);
  html = applySharedShell(html, posts, true, post.path);
  await write(post.path, html);
}

for (const page of ['index.html', 'about.html']) {
  let html = applySharedShell(await read(page), posts, false, page);
  html = applySharedMetadata(html, page);
  if (page === 'index.html') {
    html = html
      .replace('<div class="post-title">About me</div>', '<h2 class="post-title">About me</h2>')
      .replace('<div class="post-title">Latest posts</div>', '<h2 class="post-title">Latest posts</h2>');
    html = html.replace(/<div id="index-posts">[\s\S]*?<\/div>\s*<div class="small"/, `<div id="index-posts">\n${navItems(posts, './')}\n          </div>\n          <div class="small"`);
  }
  await write(page, html);
}

const feedUpdated = `${posts[0].published}T00:00:00Z`;
const feedEntries = posts.map((post) => {
  const absolute = `${canonicalRoot}${post.path}`;
  const published = `${post.published}T00:00:00Z`;
  return [
    '  <entry>',
    `    <title>${escapeXml(post.title)}</title>`,
    `    <id>${absolute}</id>`,
    `    <link href="${absolute}"/>`,
    `    <published>${published}</published>`,
    `    <updated>${published}</updated>`,
    `    <summary>${escapeXml(post.description)}</summary>`,
    '  </entry>'
  ].join('\n');
}).join('\n');
const feed = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<feed xmlns="http://www.w3.org/2005/Atom">',
  '  <title>Ween’s Projects</title>',
  `  <id>${canonicalRoot}</id>`,
  `  <link href="${canonicalRoot}"/>`,
  `  <link rel="self" href="${canonicalRoot}feed.xml"/>`,
  '  <author><name>Wayne</name></author>',
  `  <updated>${feedUpdated}</updated>`,
  feedEntries,
  '</feed>',
  ''
].join('\n');
await write('feed.xml', feed);

const sitemapUrls = [canonicalRoot, `${canonicalRoot}about.html`, ...posts.map((post) => `${canonicalRoot}${post.path}`)];
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapUrls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`),
  '</urlset>',
  ''
].join('\n');
await write('sitemap.xml', sitemap);

console.log(`Built ${posts.length} statically readable posts.`);
