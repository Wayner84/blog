/* Global site behavior: drawer menu + manifest loading */

function getSiteRoot() {
  // Works both for:
  // - https://user.github.io/ (root)
  // - https://user.github.io/repo/ (subdir)
  // - post pages under /posts/
  const path = window.location.pathname || '/';

  // Directory of the current document
  let dir = path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1);

  // If we're inside /posts/, the site root is one level up from that folder.
  if (dir.endsWith('/posts/')) dir = dir.slice(0, -('/posts/'.length));

  // Ensure it ends with a single slash.
  if (!dir.endsWith('/')) dir += '/';
  return dir;
}

function joinRoot(root, p) {
  const clean = String(p || '').replace(/^\//, '');
  return root + clean;
}

async function fetchManifest() {
  const root = getSiteRoot();
  const res = await fetch(joinRoot(root, 'posts/manifest.json'), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load manifest.json');
  return await res.json();
}

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v === false || v === null || v === undefined) continue;
    else e.setAttribute(k, String(v));
  }
  for (const c of children) e.append(c);
  return e;
}

let drawerReturnFocus = null;
let inertState = [];

function drawerFocusableElements(drawer) {
  return [...drawer.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

function setPageInert(drawer, backdrop, inert) {
  if (inert) {
    inertState = [...document.body.children]
      .filter((element) => element !== drawer && element !== backdrop)
      .map((element) => ({ element, wasInert: element.hasAttribute('inert') }));
    inertState.forEach(({ element }) => element.setAttribute('inert', ''));
    return;
  }

  inertState.forEach(({ element, wasInert }) => {
    if (!wasInert) element.removeAttribute('inert');
  });
  inertState = [];
}

function openDrawer() {
  const drawer = document.querySelector('#drawer');
  const backdrop = document.querySelector('#drawer-backdrop');
  const trigger = document.querySelector('#hamburger');
  if (!drawer || !backdrop || drawer.classList.contains('open')) return;

  drawerReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;
  drawer.hidden = false;
  backdrop.hidden = false;
  backdrop.setAttribute('aria-hidden', 'false');
  drawer.classList.add('open');
  backdrop.classList.add('open');
  trigger?.setAttribute('aria-expanded', 'true');
  trigger?.setAttribute('aria-label', 'Close menu');
  setPageInert(drawer, backdrop, true);
  document.body.style.overflow = 'hidden';
  drawerFocusableElements(drawer)[0]?.focus();
}

function closeDrawer({ returnFocus = true } = {}) {
  const drawer = document.querySelector('#drawer');
  const backdrop = document.querySelector('#drawer-backdrop');
  const trigger = document.querySelector('#hamburger');
  if (!drawer || !backdrop || !drawer.classList.contains('open')) return;

  drawer.classList.remove('open');
  backdrop.classList.remove('open');
  drawer.hidden = true;
  backdrop.hidden = true;
  backdrop.setAttribute('aria-hidden', 'true');
  trigger?.setAttribute('aria-expanded', 'false');
  trigger?.setAttribute('aria-label', 'Open menu');
  setPageInert(drawer, backdrop, false);
  document.body.style.overflow = '';
  if (returnFocus && drawerReturnFocus?.isConnected) drawerReturnFocus.focus();
  drawerReturnFocus = null;
}

function wireDrawer() {
  document.querySelector('#hamburger')?.addEventListener('click', openDrawer);
  document.querySelector('#drawer-close')?.addEventListener('click', () => closeDrawer());
  document.querySelector('#drawer-backdrop')?.addEventListener('click', () => closeDrawer());
  window.addEventListener('keydown', (event) => {
    const drawer = document.querySelector('#drawer');
    if (!drawer?.classList.contains('open')) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = drawerFocusableElements(drawer);
    if (!focusable.length) {
      event.preventDefault();
      drawer.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function markCurrentLinks() {
  const current = new URL(window.location.href);
  for (const link of document.querySelectorAll('a[href]')) {
    const target = new URL(link.getAttribute('href'), current);
    if (target.origin === current.origin && target.pathname === current.pathname) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function postDate(post) {
  return el('time', { datetime: post.isoDate || '', title: post.isoDate || '' }, [post.date]);
}

function renderDrawerPosts(posts) {
  const list = document.querySelector('#drawer-posts');
  if (!list) return;
  list.innerHTML = '';

  const root = getSiteRoot();

  posts.forEach((p) => {
    const a = el('a', { class: 'nav-link', href: joinRoot(root, p.path) }, [
      el('div', {}, [
        el('div', { class: 'name' }, [p.title]),
        el('div', { class: 'meta' }, [postDate(p)])
      ]),
      el('div', { class: 'meta', 'aria-hidden': 'true' }, ['→'])
    ]);
    a.addEventListener('click', closeDrawer);
    list.append(a);
  });
}

function renderIndexPosts(posts) {
  const list = document.querySelector('#index-posts');
  if (!list) return;
  list.innerHTML = '';

  const root = getSiteRoot();

  posts.forEach((p) => {
    const item = el('a', { class: 'nav-link', href: joinRoot(root, p.path) }, [
      el('div', {}, [
        el('div', { class: 'name' }, [p.title]),
        el('div', { class: 'meta' }, [postDate(p)])
      ]),
      el('div', { class: 'meta', 'aria-hidden': 'true' }, ['Open'])
    ]);
    list.append(item);
  });
}

async function initSite() {
  wireDrawer();

  try {
    const manifest = await fetchManifest();
    const posts = manifest.posts || [];
    renderDrawerPosts(posts);
    renderIndexPosts(posts);
    markCurrentLinks();
  } catch (err) {
    console.warn(err);
  }
}

window.__WEEN_BLOG__ = {
  getSiteRoot,
  joinRoot,
  fetchManifest,
  initSite,
  closeDrawer,
  openDrawer
};

window.addEventListener('DOMContentLoaded', initSite);
