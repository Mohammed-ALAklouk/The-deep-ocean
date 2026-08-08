// ============================================================
// Builds the dev.to copy of the post from the same blog/Blog.md.
//
//   node tools/build-crosspost.mjs                 render diagrams + write the markdown
//   node tools/build-crosspost.mjs --force         re-render diagrams that are already current
//   node tools/build-crosspost.mjs --skip-render   reuse the PNGs on disk
//   node tools/build-crosspost.mjs --publish       create a DRAFT on dev.to (needs DEVTO_API_KEY)
//
// Three things have to change between the site version and the dev.to one:
//
//   SVG   dev.to will not render it → rendered to a 2x PNG and hotlinked
//         from the site, where the file is already published.
//   MP4   dev.to cannot host video → the markdown keeps pointing at the .gif,
//         but the gifs are not in the repo (7.6 MB), so they are left as
//         upload placeholders for the editor.
//   TITLE dev.to takes it from the front matter, so the leading H1 is
//         dropped to avoid printing it twice.
//
// Everything else is your markdown, verbatim.
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { ROOT, POST, MEDIA_BASE } from './post.config.mjs';

const SRC       = join(ROOT, 'blog', 'Blog.md');
const MEDIA_DIR = join(ROOT, 'blog', 'media');
const OUT_DIR   = join(ROOT, 'blog', 'export');
const OUT       = join(OUT_DIR, 'devto.md');

// Anything still carrying this marker has to be replaced by hand in the
// dev.to editor. --publish refuses to send a post that still contains one.
const UPLOAD_MARKER = 'UPLOAD://';

const args        = process.argv.slice(2);
const force       = args.includes('--force');
const skipRender  = args.includes('--skip-render');
const doPublish   = args.includes('--publish');

// ---- rendering the diagrams -------------------------------------------
// Headless Chrome rather than an SVG library: these diagrams were drawn
// against a browser's CSS and system fonts, so the browser is the one
// renderer guaranteed to reproduce them exactly. It also keeps this repo
// dependency-free.

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function findBrowser() {
  const found = BROWSERS.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      'No Chrome or Edge found for rendering the diagrams.\n' +
      'Set CHROME_PATH to a browser binary, or pass --skip-render to reuse the PNGs on disk.'
    );
  }
  return found;
}

// The diagrams carry explicit width/height; fall back to the viewBox.
function intrinsicSize(svg) {
  const w = svg.match(/\bwidth="([\d.]+)"/);
  const h = svg.match(/\bheight="([\d.]+)"/);
  if (w && h) return { width: Number(w[1]), height: Number(h[1]) };

  const box = svg.match(/viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"/);
  if (box) return { width: Number(box[1]), height: Number(box[2]) };

  throw new Error('cannot work out the size of the SVG');
}

function renderPng(browser, svgPath, pngPath) {
  const { width, height } = intrinsicSize(readFileSync(svgPath, 'utf8'));

  // A wrapper page, so the SVG lands at a known size in a known place
  // instead of relying on how the browser lays out a bare SVG document.
  const wrapper = join(tmpdir(), `crosspost-${basename(svgPath, '.svg')}.html`);
  writeFileSync(wrapper, `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#fff}
img{display:block;width:${width}px;height:${height}px}</style>
<img src="${pathToFileURL(svgPath).href}">`);

  execFileSync(browser, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',            // 2x, so it stays sharp on a retina screen
    `--window-size=${width},${height}`,
    `--screenshot=${resolve(pngPath)}`,         // needs a native absolute path
    pathToFileURL(wrapper).href,
  ], { stdio: 'pipe' });

  return { width: width * 2, height: height * 2 };
}

// ---- transform ---------------------------------------------------------

// [ \t] rather than \s for the trailing run: \s would match the newline as
// well and eat the blank line that separates the image from what follows.
const IMAGE_RE = /^!\[([^\]]*)\]\((media\/[^)\s]+)\)[ \t]*$/gm;

function transform(markdown) {
  const uploads = [];
  const rendered = [];

  // dev.to prints the title from the front matter.
  let body = markdown.replace(/^#\s+.*\n+/, '');

  body = body.replace(IMAGE_RE, (whole, alt, src) => {
    const name = basename(src);

    if (name.endsWith('.svg')) {
      const png = name.replace(/\.svg$/, '.png');
      rendered.push({ svg: name, png });
      return `![${alt}](${MEDIA_BASE}${png})`;
    }

    if (name.endsWith('.gif')) {
      uploads.push(name);
      return `![${alt}](${UPLOAD_MARKER}${name})`;
    }

    return `![${alt}](${MEDIA_BASE}${name})`;
  });

  return { body, uploads, rendered };
}

// dev.to shows the description in search results and on the card, where
// anything past ~160 characters is cut off mid-word anyway.
function shorten(text, max = 160) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…';
}

// JSON string syntax is valid YAML double-quoted syntax, which saves
// hand-rolling the escaping for the quotes and colons in the dek.
const yamlString = (s) => JSON.stringify(s);

function frontMatter(title, description) {
  return [
    '---',
    `title: ${yamlString(title)}`,
    'published: false',
    `description: ${yamlString(description)}`,
    `tags: ${POST.tags.join(', ')}`,
    `canonical_url: ${POST.canonical}`,
    `cover_image: ${POST.ogImage}`,
    '---',
    '',
    '',   // blank line between the front matter and the post
  ].join('\n');
}

// ---- build -------------------------------------------------------------

// Normalised to LF on the way in: Blog.md is CRLF, and `.` in a JavaScript
// regex does not match \r, so every line-anchored pattern below would miss.
const markdown = readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
const title = (markdown.match(/^#\s+(.*)$/m) || [, 'Untitled'])[1].trim();
const description = shorten(POST.dek);

const { body, uploads, rendered } = transform(markdown);

if (!skipRender) {
  const browser = findBrowser();
  console.log(`rendering diagrams with ${basename(browser)}`);

  for (const { svg, png } of rendered) {
    const svgPath = join(MEDIA_DIR, svg);
    const pngPath = join(MEDIA_DIR, png);

    const current = existsSync(pngPath) && statSync(pngPath).mtimeMs >= statSync(svgPath).mtimeMs;
    if (current && !force) {
      console.log(`  ${png} — up to date`);
      continue;
    }

    const { width, height } = renderPng(browser, svgPath, pngPath);
    const kb = Math.round(statSync(pngPath).size / 1024);
    console.log(`  ${png} — ${width}x${height}, ${kb} KB`);
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, frontMatter(title, description) + body, 'utf8');

console.log(`\nblog/export/devto.md — ${rendered.length} diagrams hotlinked, ${uploads.length} clips to upload`);

// ---- what is left to do by hand ---------------------------------------

console.log(`
Before this reads correctly on dev.to:

  1. Commit and deploy blog/media/*.png. The markdown hotlinks them from
     ${MEDIA_BASE}
     so they have to be live first.

  2. Paste blog/export/devto.md into the dev.to editor (markdown mode), then
     drag these in where the ${UPLOAD_MARKER} placeholders are:
${uploads.map((f) => `       blog/media/${f}`).join('\n')}

  3. Publish here first and let Google index it before you cross-post.
     canonical_url is already set to ${POST.canonical}

For Medium, there is no file to export — paste ${POST.canonical}
into medium.com/p/import. It scrapes the live page and sets its canonical
to it automatically. The four clips are <video> on the site and Medium will
drop them, so drag the same gifs in afterwards.
`);

// ---- optional: create a dev.to draft ----------------------------------

if (doPublish) {
  const key = process.env.DEVTO_API_KEY;
  if (!key) {
    console.error('DEVTO_API_KEY is not set — get one from dev.to → Settings → Extensions → DEV Community API Keys.');
    process.exit(1);
  }

  if (body.includes(UPLOAD_MARKER)) {
    console.error(
      `\nRefusing to send: the markdown still has ${uploads.length} ${UPLOAD_MARKER} placeholder(s) in it.\n` +
      'Upload the clips and replace the placeholders in blog/export/devto.md first, or drop --publish\n' +
      'and paste the file into the editor instead.'
    );
    process.exit(1);
  }

  // published: false — this creates a DRAFT. Nothing goes public until you
  // press publish on dev.to yourself.
  const res = await fetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: {
      'api-key': key,
      'content-type': 'application/json',
      'accept': 'application/vnd.forem.api-v1+json',
    },
    body: JSON.stringify({
      article: {
        title,
        // The API takes the metadata as JSON fields, so the front matter
        // written for the editor comes back off here.
        body_markdown: readFileSync(OUT, 'utf8').replace(/^---\n[\s\S]*?\n---\n+/, ''),
        published: false,
        canonical_url: POST.canonical,
        description,
        tags: POST.tags,
        main_image: POST.ogImage,
      },
    }),
  });

  if (!res.ok) {
    console.error(`dev.to returned ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const article = await res.json();
  console.log(`draft created: ${article.url || `https://dev.to/dashboard`}`);
}
