import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

function visibleDocument(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
}

function count(pattern, text) {
  return [...text.matchAll(pattern)].length;
}

test('every post is statically readable and publication-ready', async () => {
  const manifest = JSON.parse(await read('posts/manifest.json'));
  const postFiles = (await readdir(path.join(root, 'posts')))
    .filter((name) => name.endsWith('.html'))
    .sort();

  assert.equal(manifest.posts.length, postFiles.length, 'manifest must list every post');
  assert.deepEqual(
    manifest.posts.map((post) => path.basename(post.path)).sort(),
    postFiles,
    'manifest and post files must agree'
  );

  for (const post of manifest.posts) {
    assert.match(post.published, /^20\d{2}-\d{2}-\d{2}$/);
    assert.ok(post.description?.length >= 50, `${post.path} needs a useful description`);

    const html = await read(post.path);
    const visible = visibleDocument(html);
    assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/marked|marked\.min\.js/);
    assert.match(html, /<title>[^<]+ — Ween’s Projects<\/title>/);
    assert.doesNotMatch(html, /<title>Post —/);
    assert.match(html, /<meta name="description" content="[^"]+"/);
    assert.match(html, /<link rel="canonical" href="https:\/\/wayner84\.github\.io\/blog\/posts\/[^"]+"/);
    assert.match(html, /<meta property="og:title" content="[^"]+"/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
    assert.match(html, /<time[^>]+datetime="20\d{2}-\d{2}-\d{2}"/);
    assert.match(visible, /<div class="markdown" id="post-content">\s*<(?:p|h2|figure|ul|ol|blockquote)\b/);
    assert.equal(count(/<h1\b/gi, visible), 1, `${post.path} must have one visible h1`);
    assert.doesNotMatch(visible, /\[Photo placeholder:/i);

    const source = html.match(/<script type="text\/markdown" id="post-markdown">([\s\S]*?)<\/script>/)?.[1]?.trim();
    assert.ok(source, `${post.path} needs Markdown source`);
    const bodySource = source.replace(/^\s*#\s+.+\n+/, '');
    const expectedText = new JSDOM(`<body>${await marked.parse(bodySource, { gfm: true })}</body>`).window.document.body.textContent.replace(/\s+/g, ' ').trim();
    const actualText = new JSDOM(visible).window.document.querySelector('#post-content')?.textContent.replace(/\s+/g, ' ').trim();
    assert.equal(actualText, expectedText, `${post.path} rendered content is stale`);

    const currentName = path.basename(post.path);
    assert.match(html, new RegExp(`<a class="nav-link"[^>]*href="\\.\\.\\/posts\\/${currentName.replaceAll('.', '\\.')}"[^>]*aria-current="page"`));

    for (const socialImage of html.matchAll(/<meta (?:property="og:image"|name="twitter:image") content="https:\/\/wayner84\.github\.io\/blog\/([^"]+)"/g)) {
      await access(path.join(root, socialImage[1]));
    }

    for (const image of visible.matchAll(/<img\b[^>]*>/gi)) {
      assert.match(image[0], /\bwidth="\d+"/);
      assert.match(image[0], /\bheight="\d+"/);
      assert.match(image[0], /\bdecoding="async"/);
      assert.match(image[0], /\bloading="(?:eager|lazy)"/);
    }
  }
});

test('shared pages expose keyboard-ready navigation and a skip link', async () => {
  const pages = ['index.html', 'about.html', ...(await readdir(path.join(root, 'posts')))
    .filter((name) => name.endsWith('.html')).map((name) => `posts/${name}`)];

  for (const page of pages) {
    const html = await read(page);
    assert.match(html, /class="skip-link" href="#main-content"/);
    assert.match(html, /id="hamburger"[^>]+aria-controls="drawer"[^>]+aria-expanded="false"/);
    assert.match(html, /id="drawer"[^>]+role="dialog"[^>]+aria-modal="true"[^>]+hidden/);
    assert.match(html, /<main[^>]+id="main-content"/);
  }
});

test('audited unsafe blanket claims and stale placeholders are qualified', async () => {
  const cnc = await read('posts/cnc-first-actual-test-09.06.26.html');
  const moreCnc = await read('posts/more-cnc-16.06.26.html');
  const docker = await read('posts/docker-containers-ive-found-helpful-and-a-new-ai-agent-25.05.26.html');
  const lemons = await read('posts/when-life-gives-you-lemons-04.03.26.html');
  const muft = await read('posts/muft-upgrade-04.03.26.html');

  assert.doesNotMatch(cnc, /2-flute cutters don’t cut along the whole length/);
  assert.doesNotMatch(cnc, /so I can be sure I won’t crash/);
  assert.match(moreCnc, /machine stopped|stopped the machine/i);
  assert.doesNotMatch(moreCnc, /everything is clamped right/);
  assert.doesNotMatch(docker, /Everything is private/);
  assert.doesNotMatch(docker, /there’s no spending money on tokens/);
  assert.doesNotMatch(docker, /after about 50 documents it starts getting better/);
  assert.doesNotMatch(lemons, /## MUFT Upgrade/i);
  assert.doesNotMatch(muft, /\[Photo placeholder:/i);
  assert.doesNotMatch(await read('posts/cnc-control-with-cncjs-tool-holders-and-portable-cad-18.06.26.html'), /current project-status link still needs adding/i);
  const app = await read('posts/app-development-05.07.26.html');
  assert.doesNotMatch(app, /maximum safe angle|safely use it without crashing/i);
  assert.match(app, /geometric estimate/i);
  assert.doesNotMatch(muft, /intended length and width still need confirming/i);
  assert.doesNotMatch(await read('posts/vee-block-clamp-tests-14.02.26.html'), /intended dimensions need confirming/i);
});

test('build publishes a complete feed and sitemap', async () => {
  const manifest = JSON.parse(await read('posts/manifest.json'));
  const feed = await read('feed.xml');
  const sitemap = await read('sitemap.xml');

  assert.match(feed, /^<\?xml version="1\.0" encoding="utf-8"\?>/);
  assert.match(feed, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.match(feed, /<author>\s*<name>Wayne<\/name>\s*<\/author>/);
  assert.equal(count(/<entry>/g, feed), manifest.posts.length);
  assert.equal(count(/<url>/g, sitemap), manifest.posts.length + 2);
  assert.match(sitemap, /<loc>https:\/\/wayner84\.github\.io\/blog\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/wayner84\.github\.io\/blog\/about\.html<\/loc>/);

  for (const post of manifest.posts) {
    const absolute = `https://wayner84.github.io/blog/${post.path}`;
    assert.ok(feed.includes(`<link href="${absolute}"/>`), `${post.path} missing from feed`);
    assert.ok(sitemap.includes(`<loc>${absolute}</loc>`), `${post.path} missing from sitemap`);
  }
});

test('shared pages have unique canonical and social metadata', async () => {
  for (const [file, canonical, title] of [
    ['index.html', 'https://wayner84.github.io/blog/', 'Ween’s Projects'],
    ['about.html', 'https://wayner84.github.io/blog/about.html', 'About'],
  ]) {
    const html = await read(file);
    assert.match(html, /<meta name="description" content="[^"]+"/);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}"`));
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}"`));
    assert.ok(html.includes(`<meta property="og:title" content="${title}`));
    assert.match(html, /<meta name="twitter:card" content="summary"/);
  }
  const about = await read('about.html');
  assert.match(about, /<a class="nav-link" href="\.\/about\.html" aria-current="page">/);
});

test('pages advertise the feed and preserve semantic headings', async () => {
  const pages = ['index.html', 'about.html', ...(await readdir(path.join(root, 'posts')))
    .filter((name) => name.endsWith('.html')).map((name) => `posts/${name}`)];

  for (const page of pages) {
    const html = await read(page);
    const href = page.startsWith('posts/') ? '../feed.xml' : './feed.xml';
    assert.match(html, new RegExp(`<link rel="alternate" type="application/atom\\+xml" title="Ween’s Projects feed" href="${href.replace('.', '\\.')}"`));
  }

  const index = await read('index.html');
  assert.match(index, /<h2 class="post-title">About me<\/h2>/);
  assert.match(index, /<h2 class="post-title">Latest posts<\/h2>/);
  assert.equal(count(/<h1\b/gi, visibleDocument(index)), 1);
});

test('styles include visible focus, link affordances, and reduced-motion support', async () => {
  const css = await read('assets/css/styles.css');
  assert.match(css, /\.skip-link\s*\{/);
  assert.match(css, /\.markdown a[^}]*text-decoration:\s*underline/s);
  assert.match(css, /\.small a[^}]*text-decoration:\s*underline/s);
  assert.match(css, /:focus-visible[^}]*outline:/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('repository ignores installed dependencies', async () => {
  const ignore = await read('.gitignore');
  assert.match(ignore, /(?:^|\r?\n)node_modules\/(?:\r?\n|$)/);
});
