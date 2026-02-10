/* Post page behavior: render markdown + prev/next navigation */

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

function renderMarkdownInto(container, markdown) {
  if (!container) return;

  // marked is loaded via CDN in the HTML.
  const html = window.marked.parse(markdown, {
    mangle: false,
    headerIds: true
  });
  container.innerHTML = html;
}

async function initPostPage() {
  try {
    const manifest = await window.__WEEN_BLOG__.fetchManifest();
    const posts = manifest.posts || [];

    const current = document.querySelector('meta[name="post:slug"]')?.content || slugFromPath(location.pathname);

    const idx = posts.findIndex(p => slugFromPath(p.path) === current);

    const prevPost = (idx >= 0 && idx < posts.length - 1) ? posts[idx + 1] : null; // older
    const nextPost = (idx > 0) ? posts[idx - 1] : null; // newer

    setBtn(document.querySelector('#btn-prev'), prevPost?.path, 'Previous');
    setBtn(document.querySelector('#btn-next'), nextPost?.path, 'Next');

    // Render markdown
    const md = document.querySelector('#post-markdown')?.textContent || '';
    renderMarkdownInto(document.querySelector('#post-content'), md);

    // Fill title/meta from the manifest when possible (single source of truth)
    const titleEl = document.querySelector('#post-title');
    const dateEl = document.querySelector('#post-date');
    if (idx >= 0) {
      if (titleEl) titleEl.textContent = posts[idx].title;
      if (dateEl) dateEl.textContent = posts[idx].date;
    }
  } catch (err) {
    console.warn(err);
    // Still render markdown even if manifest fails
    const md = document.querySelector('#post-markdown')?.textContent || '';
    renderMarkdownInto(document.querySelector('#post-content'), md);
  }
}

window.addEventListener('DOMContentLoaded', initPostPage);
