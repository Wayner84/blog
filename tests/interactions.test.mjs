import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const siteScript = await readFile(path.join(root, 'assets/js/site.js'), 'utf8');
const postScript = await readFile(path.join(root, 'assets/js/post.js'), 'utf8');

function createSite() {
  const dom = new JSDOM(`<!doctype html><body>
    <header class="header">
      <button id="hamburger" aria-controls="drawer" aria-expanded="false" aria-label="Open menu">Menu</button>
    </header>
    <div id="drawer-backdrop" aria-hidden="true" hidden></div>
    <aside id="drawer" role="dialog" aria-modal="true" hidden>
      <button id="drawer-close">Close</button>
      <a href="/about.html">About</a>
      <a href="/posts/post.html">Post</a>
      <div id="drawer-posts"></div>
    </aside>
    <main id="main-content"><button id="main-action">Main action</button></main>
  </body>`, {
    runScripts: 'outside-only',
    url: 'https://wayner84.github.io/blog/'
  });
  dom.window.fetch = async () => ({ ok: true, json: async () => ({ posts: [] }) });
  dom.window.eval(siteScript);
  dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom;
}

function press(window, key, options = {}) {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
}

test('drawer exposes modal state, hides background, and moves focus on open', () => {
  const dom = createSite();
  const { document } = dom.window;
  const trigger = document.querySelector('#hamburger');
  const drawer = document.querySelector('#drawer');
  const backdrop = document.querySelector('#drawer-backdrop');

  trigger.focus();
  trigger.click();

  assert.equal(drawer.hidden, false);
  assert.equal(backdrop.hidden, false);
  assert.equal(backdrop.getAttribute('aria-hidden'), 'false');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(trigger.getAttribute('aria-label'), 'Close menu');
  assert.equal(document.querySelector('.header').hasAttribute('inert'), true);
  assert.equal(document.querySelector('main').hasAttribute('inert'), true);
  assert.equal(document.activeElement, document.querySelector('#drawer-close'));
  assert.equal(document.body.style.overflow, 'hidden');
});

test('drawer traps Tab focus in both directions', () => {
  const dom = createSite();
  const { document } = dom.window;
  document.querySelector('#hamburger').click();
  const focusable = [...document.querySelectorAll('#drawer button, #drawer a[href]')];

  focusable.at(-1).focus();
  press(dom.window, 'Tab');
  assert.equal(document.activeElement, focusable[0]);

  focusable[0].focus();
  press(dom.window, 'Tab', { shiftKey: true });
  assert.equal(document.activeElement, focusable.at(-1));
});

test('Escape closes the drawer, restores state, and returns focus', () => {
  const dom = createSite();
  const { document } = dom.window;
  const trigger = document.querySelector('#hamburger');
  trigger.focus();
  trigger.click();

  press(dom.window, 'Escape');

  assert.equal(document.querySelector('#drawer').hidden, true);
  assert.equal(document.querySelector('#drawer-backdrop').hidden, true);
  assert.equal(document.querySelector('#drawer-backdrop').getAttribute('aria-hidden'), 'true');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(trigger.getAttribute('aria-label'), 'Open menu');
  assert.equal(document.querySelector('.header').hasAttribute('inert'), false);
  assert.equal(document.querySelector('main').hasAttribute('inert'), false);
  assert.equal(document.activeElement, trigger);
  assert.equal(document.body.style.overflow, '');
});

test('close button and backdrop close the drawer', () => {
  const dom = createSite();
  const { document } = dom.window;
  const trigger = document.querySelector('#hamburger');

  trigger.click();
  document.querySelector('#drawer-close').click();
  assert.equal(document.querySelector('#drawer').hidden, true);

  trigger.click();
  document.querySelector('#drawer-backdrop').click();
  assert.equal(document.querySelector('#drawer').hidden, true);
});

test('manifest enhancement preserves semantic dates and marks the current page', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'posts/manifest.json'), 'utf8'));
  for (const [file, url, expectedTimes, currentHref] of [
    ['index.html', 'https://wayner84.github.io/blog/', manifest.posts.length * 2, null],
    ['about.html', 'https://wayner84.github.io/blog/about.html', manifest.posts.length, './about.html'],
  ]) {
    const html = await readFile(path.join(root, file), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url });
    dom.window.fetch = async () => ({ ok: true, json: async () => structuredClone(manifest) });
    dom.window.eval(siteScript);
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    assert.equal(dom.window.document.querySelectorAll('time[datetime]').length, expectedTimes);
    if (currentHref) assert.equal(dom.window.document.querySelector(`a[href="${currentHref}"]`)?.getAttribute('aria-current'), 'page');
  }
});

test('post enhancement preserves static content without a Markdown runtime', async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <h1 id="post-title">Static title</h1>
    <time id="post-date">01.01.26</time>
    <div id="post-content"><p>Already rendered at build time.</p></div>
    <a id="btn-prev"><span data-label>Previous</span></a>
    <a id="btn-next"><span data-label>Next</span></a>
    <script type="text/markdown" id="post-markdown"># Source\n\nMarkdown source.</script>
  </body>`, {
    runScripts: 'outside-only',
    url: 'https://wayner84.github.io/blog/posts/example-01.01.26.html'
  });
  dom.window.__WEEN_BLOG__ = {
    getSiteRoot: () => '/blog/',
    joinRoot: (base, relative) => base + relative,
    fetchManifest: async () => { throw new Error('offline'); }
  };
  dom.window.console.warn = () => {};
  dom.window.eval(postScript);
  dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.equal(dom.window.document.querySelector('#post-content').innerHTML, '<p>Already rendered at build time.</p>');
  assert.equal(dom.window.document.querySelector('#post-title').textContent, 'Static title');
});
