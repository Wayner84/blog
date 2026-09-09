/* Post page behavior: progressively enhance prev/next navigation */

function slugFromPath(path) {
  return (path || '').split('/').pop();
}

function setBtn(btn, href, label) {
  if (!btn) return;
  if (!href) {
    btn.setAttribute('aria-disabled', 'true');
    btn.removeAttribute('href');
    btn.querySelector('[data-label]')?.replaceChildren(label);
    return;
  }
  btn.removeAttribute('aria-disabled');
  btn.setAttribute('href', href);
  btn.querySelector('[data-label]')?.replaceChildren(label);
}

async function initPostPage() {
  try {
    const root = window.__WEEN_BLOG__?.getSiteRoot?.() || '/';
    const joinRoot = window.__WEEN_BLOG__?.joinRoot || ((base, relative) => base + String(relative || '').replace(/^\//, ''));
    const manifest = await window.__WEEN_BLOG__?.fetchManifest?.();
    const posts = manifest?.posts || [];
    const current = document.querySelector('meta[name="post:slug"]')?.content || slugFromPath(location.pathname);
    const index = posts.findIndex((post) => slugFromPath(post.path) === current);
    if (index < 0) return;

    const older = index < posts.length - 1 ? posts[index + 1] : null;
    const newer = index > 0 ? posts[index - 1] : null;
    setBtn(document.querySelector('#btn-prev'), older ? joinRoot(root, older.path) : null, 'Previous');
    setBtn(document.querySelector('#btn-next'), newer ? joinRoot(root, newer.path) : null, 'Next');

    const title = document.querySelector('#post-title');
    const date = document.querySelector('#post-date');
    if (title) title.textContent = posts[index].title;
    if (date) date.textContent = posts[index].date;
  } catch (error) {
    // The built HTML is complete; a failed enhancement must not replace it.
    console.warn(error);
  }
}

window.addEventListener('DOMContentLoaded', initPostPage);
