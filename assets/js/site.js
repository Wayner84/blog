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

function openDrawer() {
  document.querySelector('#drawer')?.classList.add('open');
  document.querySelector('#drawer-backdrop')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  document.querySelector('#drawer')?.classList.remove('open');
  document.querySelector('#drawer-backdrop')?.classList.remove('open');
  document.body.style.overflow = '';
}

function wireDrawer() {
  document.querySelector('#hamburger')?.addEventListener('click', openDrawer);
  document.querySelector('#drawer-close')?.addEventListener('click', closeDrawer);
  document.querySelector('#drawer-backdrop')?.addEventListener('click', closeDrawer);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
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
        el('div', { class: 'meta' }, [p.date])
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
        el('div', { class: 'meta' }, [p.date])
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
