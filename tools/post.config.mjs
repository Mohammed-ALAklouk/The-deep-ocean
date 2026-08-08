// ============================================================
// Everything about the post that both builds need to agree on.
//
//   tools/build-blog.mjs       → the page on the site
//   tools/build-crosspost.mjs  → the dev.to copy
//
// The canonical URL in particular has to be identical in both, since the
// whole point of the cross-post is that it points back here.
// ============================================================

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const POST = {
  // The canonical URL. Exact, trailing slash included — a canonical that
  // redirects or 404s is worse than none at all. Change it here if the site
  // ever moves to a custom domain, then rebuild both outputs.
  canonical: 'https://mohammed-alaklouk.github.io/The-deep-ocean/blog/',
  siteUrl:   'https://mohammed-alaklouk.github.io/The-deep-ocean/',
  repoUrl:   'https://github.com/Mohammed-ALAklouk/The-deep-ocean',
  ogImage:   'https://mohammed-alaklouk.github.io/The-deep-ocean/og-image.jpg',

  author:    'Mohammed AL Aklouk',
  published: '2026-08-08',

  // Used for <meta name="description">, the social cards, the standfirst
  // under the title, and the dev.to description. Kept here rather than in
  // the markdown so Blog.md stays clean for the cross-posts.
  dek: 'Rebuilding neal.fun’s Deep Sea as a 10,924 metre scroll: syncing GSAP with Lenis, a particle system that empties out with depth, 128 creatures on a CSS grid, and the pin that quietly stretched the page by 240 metres.',

  // dev.to takes at most four, lowercase alphanumeric.
  tags: ['javascript', 'webdev', 'css', 'showdev'],
};

// Where the published assets live. The cross-post hotlinks the rendered
// diagrams from here, so these files have to be committed and deployed
// before the dev.to copy will show anything.
export const MEDIA_BASE = new URL('media/', POST.canonical).href;
