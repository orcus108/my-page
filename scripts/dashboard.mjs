// minimal local content dashboard — zero dependencies (node built-ins only)
// run: npm run dashboard   then open http://localhost:4321
import { promises as fs } from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { lookupBook, fetchCoverBuffer, dominantColor } from "./lib/book-lookup.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const contentDir = path.join(rootDir, "content");
const dirs = { project: path.join(contentDir, "projects"), blog: path.join(contentDir, "blog") };
const cardsDir = path.join(rootDir, "images", "cards");
const booksJsonPath = path.join(contentDir, "preview", "books.json");
const booksDir = path.join(contentDir, "preview", "books");
const PORT = Number(process.env.PORT) || 4321;

const EXT_BY_MIME = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp" };

function slugify(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseFront(raw) {
  if (!raw.startsWith("---\n")) return { attrs: {}, body: raw.trim() };
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) return { attrs: {}, body: raw.trim() };
  const attrs = {};
  for (const line of raw.slice(4, end).split("\n")) {
    const i = line.indexOf(":");
    if (i > -1) attrs[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { attrs, body: raw.slice(end + 5).trim() };
}

async function listType(type) {
  const dir = dirs[type];
  let names = [];
  try { names = (await fs.readdir(dir)).filter((n) => n.endsWith(".md")); } catch {}
  const items = [];
  for (const name of names) {
    const raw = await fs.readFile(path.join(dir, name), "utf8");
    const { attrs, body } = parseFront(raw);
    const slug = attrs.slug || name.replace(/\.md$/, "");
    let image = null;
    for (const ext of ["png", "jpg", "jpeg", "webp"]) {
      try { await fs.access(path.join(cardsDir, `${slug}.${ext}`)); image = `/card-image/${slug}.${ext}`; break; } catch {}
    }
    if (!image && attrs.image) image = "/" + attrs.image.replace(/^\.?\//, "");
    if (!image) { const m = body.match(/!\[[^\]]*\]\(([^)]+)\)/); if (m) image = "/" + m[1].trim().replace(/^\.?\//, ""); }
    items.push({ file: name, slug, title: attrs.title || slug, summary: attrs.summary || "", date: attrs.date || "", image });
  }
  return items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

async function readBooks() {
  try { return JSON.parse(await fs.readFile(booksJsonPath, "utf8")); } catch { return []; }
}
async function writeBooks(books) {
  await fs.writeFile(booksJsonPath, JSON.stringify(books, null, 2) + "\n");
}
function listBooks(books) {
  return books.map((b) => ({
    slug: b.slug,
    title: b.title,
    author: b.author || "",
    pages: b.pages || null,
    color: b.color || "#33384a",
    shelf: b.shelf || "",
    image: b.coverFile ? `/content/preview/${b.coverFile}` : null,
  }));
}

// ---- substack import helpers ----
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36" };

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&rsquo;/g, "’").replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&hellip;/g, "…").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCharCode(parseInt(n, 16)));
}
const stripTags = (s) => decodeEntities(String(s).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
function extFromType(ct) {
  ct = (ct || "").toLowerCase();
  return ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : ct.includes("gif") ? "gif" : ct.includes("svg") ? "svg" : "jpg";
}

async function downloadTo(srcUrl, filePathNoExt) {
  const r = await fetch(srcUrl, { headers: UA });
  if (!r.ok) throw new Error("image " + r.status);
  const ext = extFromType(r.headers.get("content-type"));
  const buf = Buffer.from(await r.arrayBuffer());
  for (const e of ["png", "jpg", "jpeg", "webp", "gif", "svg"]) await fs.rm(`${filePathNoExt}.${e}`, { force: true });
  await fs.writeFile(`${filePathNoExt}.${ext}`, buf);
  return ext;
}

// remove non-content blocks substack injects into body_html (subscribe widgets, share
// buttons, paywalls, poll/podcast embeds, comment prompts). these nest <div>s, so match
// the opening tag then depth-scan to its real close — a plain regex can't pair nested divs.
const JUNK_BLOCK = /class="[^"]*\b(subscription-widget|subscribe-widget|button-wrapper|share|paywall|poll|podcast|audio|comments|footer|digest|preview-cta|cta-)[^"]*"/i;
const JUNK_COMPONENT = /data-component-name="(Subscribe|Share|Paywall|Comment|Poll|Audio|Podcast|Digest)/i;
function stripWidgets(html) {
  let out = html, i = 0;
  while (true) {
    const open = out.indexOf("<div", i);
    if (open === -1) break;
    const tagEnd = out.indexOf(">", open);
    if (tagEnd === -1) break;
    const tag = out.slice(open, tagEnd + 1);
    if (JUNK_BLOCK.test(tag) || JUNK_COMPONENT.test(tag)) {
      let depth = 1, j = tagEnd + 1;
      while (j < out.length && depth > 0) {
        const nextOpen = out.indexOf("<div", j);
        const nextClose = out.indexOf("</div>", j);
        if (nextClose === -1) { j = out.length; break; }
        if (nextOpen !== -1 && nextOpen < nextClose) { depth++; j = nextOpen + 4; }
        else { depth--; j = nextClose + 6; }
      }
      out = out.slice(0, open) + out.slice(j);
      i = open;
    } else {
      i = open + 4;
    }
  }
  return out;
}

function htmlToMarkdown(html, imgMap) {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|form)[\s\S]*?<\/\1>/gi, "");
  // substack wraps images in lightbox <a> tags (often around a <picture>); unwrap to the
  // inner <img> so it becomes a markdown image below instead of an empty [](href) link
  s = s.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (m, inner) => {
    const img = inner.match(/<img[^>]*>/i);
    return img ? img[0] : m;
  });
  // inline first so links/bold survive inside headings & list items
  s = s.replace(/<a[^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, c) => `[${stripTags(c)}](${href})`);
  s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, c) => `**${stripTags(c)}**`);
  s = s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, c) => `*${stripTags(c)}*`);
  // images -> markdown (mapped to local downloaded paths)
  s = s.replace(/<img[^>]*?src="([^"]+)"[^>]*>/gi, (m, src) => {
    const alt = (m.match(/alt="([^"]*)"/) || [, ""])[1];
    return `\n\n![${alt}](${imgMap[src] || src})\n\n`;
  });
  s = s.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, (_m, c) => `\n\n*${stripTags(c)}*\n\n`);
  // blocks
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_m, c) => `\n\n# ${stripTags(c)}\n\n`);
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, c) => `\n\n## ${stripTags(c)}\n\n`);
  s = s.replace(/<h[3-6][^>]*>([\s\S]*?)<\/h[3-6]>/gi, (_m, c) => `\n\n### ${stripTags(c)}\n\n`);
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, c) => "\n\n" + stripTags(c).split("\n").map((l) => `> ${l}`).join("\n") + "\n\n");
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, c) => `\n- ${stripTags(c)}`);
  s = s.replace(/<\/(ul|ol)>/gi, "\n\n").replace(/<(ul|ol)[^>]*>/gi, "\n");
  s = s.replace(/<hr[^>]*>/gi, "\n\n---\n\n").replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n\n").replace(/<p[^>]*>/gi, "");
  s = s.replace(/<[^>]+>/g, ""); // strip the rest
  return decodeEntities(s).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// the substack.com reader domain serves posts at /home/post/p-<id> (and similar),
// where the path is a numeric post id, not the publication slug. resolve those to the
// real publication url (e.g. https://you.substack.com/p/the-slug) before importing.
async function resolveSubstackUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return rawUrl; }
  if (!/(^|\.)substack\.com$/.test(u.hostname)) return rawUrl; // already a publication url or custom domain
  if (!/^(www\.)?substack\.com$/.test(u.hostname)) return rawUrl; // a *.substack.com publication is already canonical
  const idMatch = u.pathname.match(/(\d{4,})/);
  if (idMatch) {
    try {
      const r = await fetch(`https://substack.com/api/v1/posts/by-id/${idMatch[1]}`, { headers: { ...UA, Accept: "application/json" } });
      if (r.ok) {
        const j = await r.json();
        const canonical = (j && (j.post || j)).canonical_url;
        if (canonical) return canonical;
      }
    } catch {}
  }
  // fallback: follow the reader-page redirect to the canonical url
  try {
    const r = await fetch(rawUrl, { headers: UA });
    if (r.url && !/^https?:\/\/(www\.)?substack\.com\//.test(r.url)) return r.url;
  } catch {}
  return rawUrl;
}

async function importSubstack(rawUrl) {
  rawUrl = await resolveSubstackUrl(rawUrl);
  const u = new URL(rawUrl);
  const parts = u.pathname.split("/").filter(Boolean);
  const pIdx = parts.indexOf("p");
  const urlSlug = (pIdx >= 0 ? parts[pIdx + 1] : parts[parts.length - 1]) || "";
  let post = null;
  try {
    const r = await fetch(`${u.origin}/api/v1/posts/${urlSlug}`, { headers: { ...UA, Accept: "application/json" } });
    if (r.ok) post = await r.json();
  } catch {}

  let title, subtitle, dateIso, bodyHtml, cover;
  if (post && post.body_html) {
    title = post.title; subtitle = post.subtitle || ""; dateIso = post.post_date || ""; bodyHtml = post.body_html; cover = post.cover_image || "";
  } else {
    // fallback: scrape og + main content
    const r = await fetch(rawUrl, { headers: UA });
    if (!r.ok) throw new Error("could not fetch article (" + r.status + ")");
    const html = await r.text();
    const og = (p) => (html.match(new RegExp(`<meta[^>]+property="${p}"[^>]+content="([^"]*)"`, "i")) || [, ""])[1];
    title = decodeEntities(og("og:title") || "");
    subtitle = decodeEntities(og("og:description") || "");
    cover = og("og:image") || "";
    dateIso = (html.match(/"datePublished":"([^"]+)"/) || [, ""])[1] || (html.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i) || [, ""])[1];
    const cm = html.match(/<div class="body markup"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i) || html.match(/class="available-content"[^>]*>([\s\S]*?)<div class="(?:subscribe|paywall)/i);
    bodyHtml = cm ? cm[1] : "";
    if (!title && !bodyHtml) throw new Error("couldn't parse this page — is it a public Substack post?");
  }

  bodyHtml = stripWidgets(bodyHtml);
  const slug = slugify(urlSlug || title);
  const srcs = [...bodyHtml.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1]);
  const imgMap = {};
  if (srcs.length) {
    const dir = path.join(rootDir, "images", "posts", slug);
    await fs.mkdir(dir, { recursive: true });
    let i = 0;
    for (const src of srcs) {
      try { const ext = await downloadTo(src, path.join(dir, String(i))); imgMap[src] = `images/posts/${slug}/${i}.${ext}`; i++; } catch {}
    }
  }
  const body = htmlToMarkdown(bodyHtml, imgMap);

  let cardImage = null;
  if (cover) {
    try {
      await fs.mkdir(cardsDir, { recursive: true });
      const ext = await downloadTo(cover, path.join(cardsDir, slug));
      cardImage = `/card-image/${slug}.${ext}?t=${Date.now()}`;
    } catch {}
  }

  const words = body.split(/\s+/).filter(Boolean).length;
  const read_time = `${Math.max(1, Math.round(words / 200))} min read`;
  return { fields: { title: title || slug, slug, summary: subtitle, date: (dateIso || "").slice(0, 10) || new Date().toISOString().slice(0, 10), read_time }, body, cardImage };
}

function buildFrontmatter(type, f) {
  const lines = [];
  const add = (k, v) => { if (v !== undefined && v !== null && String(v).trim() !== "") lines.push(`${k}: ${v}`); };
  add("title", f.title);
  add("slug", f.slug);
  if (type === "blog") {
    add("date", f.date);
    add("read_time", f.read_time);
    add("summary", f.summary);
  } else {
    add("summary", f.summary);
    add("date", f.date);
    add("stack", f.stack);
    add("repo", f.repo);
    add("demo", f.demo);
    if (f.featured) lines.push("featured: true");
    add("order", f.order);
  }
  return `---\n${lines.join("\n")}\n---\n`;
}

function runBuild() {
  return new Promise((resolve) => {
    // site/ is the deployed build output (see vercel.json), so that's all we need to rebuild here
    exec("node scripts/build.mjs site", { cwd: rootDir }, (err, stdout, stderr) => {
      resolve({ ok: !err, log: (stdout || "") + (stderr || "") });
    });
  });
}

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type });
  if (typeof body === "string" || Buffer.isBuffer(body)) res.end(body);
  else res.end(JSON.stringify(body));
}

function readBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("payload too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, PAGE, "text/html; charset=utf-8");

    if (req.method === "GET" && url.pathname === "/api/list") {
      return send(res, 200, {
        project: await listType("project"),
        blog: await listType("blog"),
        book: listBooks(await readBooks()),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/book") {
      const slug = url.searchParams.get("slug");
      const book = (await readBooks()).find((b) => b.slug === slug);
      if (!book) return send(res, 404, { error: "not found" });
      return send(res, 200, { book });
    }

    if (req.method === "POST" && url.pathname === "/api/book-lookup") {
      const { title, author } = JSON.parse((await readBody(req)).toString("utf8"));
      if (!title) return send(res, 400, { error: "enter a book title" });
      console.log(`  looking up "${title}"…`);
      const meta = await lookupBook(title, author || "");
      if (!meta) return send(res, 404, { error: "no match on open library — try adding the author" });
      let coverDataUrl = null, color = null;
      const cover = await fetchCoverBuffer(meta).catch(() => null);
      if (cover) {
        coverDataUrl = `data:image/jpeg;base64,${cover.buffer.toString("base64")}`;
        color = dominantColor(cover.buffer);
      }
      console.log(`  ✓ "${meta.title}" — cover=${cover ? "ok" : "none"} pages=${meta.pages || "?"}`);
      return send(res, 200, {
        fields: {
          title: meta.title,
          author: meta.author,
          pages: meta.pages,
          isbn: meta.isbn,
          color: color || "#33384a",
        },
        coverDataUrl,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/book-save") {
      const data = JSON.parse((await readBody(req)).toString("utf8"));
      const f = data.fields || {};
      if (!f.title) return send(res, 400, { error: "title is required" });
      const slug = slugify(f.slug || f.title);
      const dir = path.join(booksDir, slug);

      let color = (f.color || "").trim();
      let coverFile = data.existingCoverFile || null;
      if (data.coverDataUrl) {
        const m = data.coverDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) return send(res, 400, { error: "bad cover data" });
        const buf = Buffer.from(m[2], "base64");
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, "cover.jpg"), buf);
        coverFile = `books/${slug}/cover.jpg`;
        if (!color) color = dominantColor(buf) || "#33384a";
      }
      if (!color) color = "#33384a";

      const books = await readBooks();
      const entry = {
        title: f.title.trim(),
        author: (f.author || "").trim(),
        shelf: (f.shelf || "").trim(),
        color,
        slug,
        isbn: (f.isbn || "").trim() || null,
        pages: f.pages ? parseInt(String(f.pages).replace(/\D/g, ""), 10) || null : null,
        coverFile,
        spineFile: null,
        spineSource: null,
      };
      const idx = books.findIndex((b) => b.slug === slug);
      if (idx >= 0) books[idx] = { ...books[idx], ...entry };
      else books.push(entry);
      await writeBooks(books);
      console.log(`  saved book ${slug} — rebuilding…`);
      const build = await runBuild();
      console.log(build.ok ? `  ✓ rebuilt` : `  ✗ build error:\n${build.log}`);
      return send(res, 200, { ok: true, slug, coverFile, color, build });
    }

    if (req.method === "POST" && url.pathname === "/api/book-delete") {
      const { slug } = JSON.parse((await readBody(req)).toString("utf8"));
      if (!slug) return send(res, 400, { error: "bad request" });
      const books = (await readBooks()).filter((b) => b.slug !== slug);
      await writeBooks(books);
      await fs.rm(path.join(booksDir, slug), { recursive: true, force: true });
      const build = await runBuild();
      return send(res, 200, { ok: true, build });
    }

    if (req.method === "GET" && url.pathname === "/api/item") {
      const type = url.searchParams.get("type");
      const slug = url.searchParams.get("slug");
      if (!dirs[type] || !slug) return send(res, 400, { error: "bad request" });
      const file = path.join(dirs[type], `${slug}.md`);
      const raw = await fs.readFile(file, "utf8").catch(() => null);
      if (raw == null) return send(res, 404, { error: "not found" });
      const { attrs, body } = parseFront(raw);
      return send(res, 200, { attrs, body });
    }

    if (req.method === "GET" && url.pathname.startsWith("/card-image/")) {
      const name = decodeURIComponent(url.pathname.slice("/card-image/".length));
      const data = await fs.readFile(path.join(cardsDir, name)).catch(() => null);
      if (!data) return send(res, 404, "not found", "text/plain");
      const ext = path.extname(name).slice(1);
      return send(res, 200, data, `image/${ext === "jpg" ? "jpeg" : ext}`);
    }

    if (req.method === "POST" && url.pathname === "/api/import") {
      const { url: articleUrl } = JSON.parse((await readBody(req)).toString("utf8"));
      if (!articleUrl) return send(res, 400, { error: "paste a substack article url" });
      console.log(`  importing ${articleUrl} …`);
      const result = await importSubstack(articleUrl);
      console.log(`  ✓ imported "${result.fields.title}"`);
      return send(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/save") {
      const data = JSON.parse((await readBody(req)).toString("utf8"));
      const type = data.type;
      if (!dirs[type]) return send(res, 400, { error: "type must be project or blog" });
      const f = data.fields || {};
      if (!f.title) return send(res, 400, { error: "title is required" });
      const slug = slugify(f.slug || f.title);
      f.slug = slug;

      // image (data URL) → images/cards/<slug>.<ext>
      if (data.imageDataUrl) {
        const m = data.imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) return send(res, 400, { error: "bad image data" });
        const ext = EXT_BY_MIME[m[1].toLowerCase()];
        if (!ext) return send(res, 400, { error: "image must be png, jpg, or webp" });
        await fs.mkdir(cardsDir, { recursive: true });
        // remove any existing card image with a different extension for this slug
        for (const e of ["png", "jpg", "jpeg", "webp"]) {
          if (e !== ext) await fs.rm(path.join(cardsDir, `${slug}.${e}`), { force: true });
        }
        await fs.writeFile(path.join(cardsDir, `${slug}.${ext}`), Buffer.from(m[2], "base64"));
      }

      let body = (data.body || "").trim();
      // in-post hero image → images/posts/<slug>/0.<ext> (updates first ![](...) in body)
      if (data.bodyImageDataUrl) {
        const m = data.bodyImageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) return send(res, 400, { error: "bad in-post image data" });
        const ext = EXT_BY_MIME[m[1].toLowerCase()];
        if (!ext) return send(res, 400, { error: "in-post image must be png, jpg, or webp" });
        const postDir = path.join(rootDir, "images", "posts", slug);
        await fs.mkdir(postDir, { recursive: true });
        for (const e of ["png", "jpg", "jpeg", "webp", "gif"]) {
          await fs.rm(path.join(postDir, `0.${e}`), { force: true });
        }
        await fs.writeFile(path.join(postDir, `0.${ext}`), Buffer.from(m[2], "base64"));
        const imgPath = `images/posts/${slug}/0.${ext}`;
        body = /!\[[^\]]*\]\([^)]+\)/.test(body)
          ? body.replace(/!\[[^\]]*\]\([^)]+\)/, `![](${imgPath})`)
          : `![](${imgPath})\n\n${body}`;
      }

      const md = `${buildFrontmatter(type, f)}\n${body}\n`;
      await fs.writeFile(path.join(dirs[type], `${slug}.md`), md, "utf8");
      console.log(`  saved ${type}/${slug}.md — rebuilding…`);

      const build = await runBuild();
      console.log(build.ok ? `  ✓ rebuilt` : `  ✗ build error:\n${build.log}`);
      return send(res, 200, { ok: true, slug, body, build });
    }

    if (req.method === "POST" && url.pathname === "/api/delete") {
      const { type, slug } = JSON.parse((await readBody(req)).toString("utf8"));
      if (!dirs[type] || !slug) return send(res, 400, { error: "bad request" });
      await fs.rm(path.join(dirs[type], `${slug}.md`), { force: true });
      for (const e of ["png", "jpg", "jpeg", "webp"]) await fs.rm(path.join(cardsDir, `${slug}.${e}`), { force: true });
      const build = await runBuild();
      return send(res, 200, { ok: true, build });
    }

    // static file fallback (serves the generated site, e.g. /site/index.html)
    if (req.method === "GET") {
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const target = path.join(rootDir, rel);
      if (target.startsWith(rootDir)) {
        let file = target;
        try {
          if ((await fs.stat(file)).isDirectory()) file = path.join(file, "index.html");
          const data = await fs.readFile(file);
          return send(res, 200, data, CONTENT_TYPE[path.extname(file).toLowerCase()] || "application/octet-stream");
        } catch {}
      }
    }

    send(res, 404, { error: "not found" });
  } catch (err) {
    send(res, 500, { error: String(err && err.message || err) });
  }
});

const CONTENT_TYPE = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".json": "application/json", ".ico": "image/x-icon",
};

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  dashboard running → http://localhost:${PORT}\n  (writes to content/ and images/cards/, then rebuilds)\n`);
});

const PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>content studio</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  :root { --fg:#0c0c0c; --muted:#6d6d6d; --faint:#9a9a9a; --line:#e8e8e8; --accent:#0c0c0c; --ok:#0a7d27; --err:#b00020; --bg:#fbfbfb; --panel:#fff; }
  * { box-sizing:border-box; }
  html, body { height:100%; }
  body { margin:0; font-family:"Plus Jakarta Sans",system-ui,sans-serif; color:var(--fg); background:var(--bg); line-height:1.5; }
  .top { height:56px; display:flex; align-items:center; justify-content:space-between; padding:0 1.25rem; border-bottom:1px solid var(--line); background:var(--panel); }
  .top-l { display:flex; align-items:center; gap:0.6rem; min-width:0; }
  .top-l h1 { margin:0; font-size:0.95rem; font-weight:700; letter-spacing:-0.02em; }
  .top-l .sub { font-size:0.72rem; color:var(--faint); white-space:nowrap; }
  .dot { width:9px; height:9px; border-radius:50%; background:var(--ok); box-shadow:0 0 0 3px rgba(10,125,39,0.14); flex:0 0 auto; }
  .top-r { display:flex; align-items:center; gap:0.55rem; }
  .ghost { border:1px solid var(--line); background:var(--panel); border-radius:7px; padding:0.34rem 0.7rem; font:inherit; font-size:0.8rem; color:var(--muted); cursor:pointer; text-decoration:none; }
  .ghost:hover { color:var(--fg); border-color:var(--fg); }

  .wrap { display:grid; grid-template-columns:248px minmax(360px,1fr) minmax(380px,1.05fr); height:calc(100vh - 56px); }
  body.no-preview .wrap { grid-template-columns:248px 1fr; }
  body.no-preview .preview { display:none; }

  .side { border-right:1px solid var(--line); background:var(--panel); overflow-y:auto; padding-bottom:1rem; }
  .new { margin:1rem 1rem 0.5rem; padding:0.6rem; width:calc(100% - 2rem); border:1px dashed var(--line); border-radius:9px; background:none; cursor:pointer; font:inherit; font-size:0.85rem; color:var(--muted); }
  .new:hover { border-color:var(--fg); color:var(--fg); }
  .side-sec h2 { font-size:0.66rem; letter-spacing:0.13em; text-transform:uppercase; color:var(--faint); margin:1rem 1.1rem 0.35rem; }
  .item { display:flex; gap:0.65rem; align-items:center; padding:0.45rem 1.1rem; cursor:pointer; border:0; background:none; width:100%; text-align:left; font:inherit; border-left:2px solid transparent; }
  .item:hover { background:#f5f5f5; }
  .item.sel { border-left-color:var(--fg); background:#f1f1f1; }
  .item .th { width:42px; height:32px; border-radius:5px; background-color:#eee; background-image:var(--thumb, none); background-position:center; background-size:cover; flex:0 0 auto; border:1px solid var(--line); }
  .item .t { font-size:0.83rem; font-weight:500; line-height:1.2; }
  .item .d { font-size:0.7rem; color:var(--faint); }

  .editor { display:flex; flex-direction:column; min-width:0; overflow:hidden; }
  .ed-scroll { overflow-y:auto; flex:1; padding:1.4rem 1.6rem 1.5rem; }
  .tabs { display:inline-flex; border:1px solid var(--line); border-radius:999px; overflow:hidden; margin-bottom:1.25rem; }
  .tabs button { border:0; background:var(--panel); padding:0.4rem 1.1rem; font:inherit; font-size:0.84rem; cursor:pointer; color:var(--muted); }
  .tabs button.on { background:var(--accent); color:#fff; }
  .import { background:#fafafa; border:1px solid var(--line); border-radius:11px; padding:0.85rem 0.9rem; margin-bottom:1.35rem; }
  .import-row { display:flex; gap:0.5rem; }
  .import-row input { flex:1; }
  .import-row button { border:0; background:var(--accent); color:#fff; border-radius:8px; padding:0 1.1rem; font:inherit; font-weight:600; cursor:pointer; white-space:nowrap; }
  .import-row button:disabled { opacity:0.5; cursor:default; }
  label { display:block; font-size:0.76rem; font-weight:600; color:var(--muted); margin:0.9rem 0 0.3rem; }
  input[type=text], input[type=date], textarea, select { width:100%; padding:0.55rem 0.65rem; border:1px solid var(--line); border-radius:8px; font:inherit; font-size:0.88rem; background:var(--panel); color:var(--fg); }
  input:focus, textarea:focus, select:focus { outline:none; border-color:var(--fg); }
  textarea { min-height:340px; resize:vertical; font-family:ui-monospace,Menlo,monospace; font-size:0.82rem; line-height:1.65; }
  .row { display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; }
  .hint { font-size:0.7rem; color:var(--faint); margin-top:0.4rem; }
  .faint { color:var(--faint); }
  .chk { display:flex; align-items:center; gap:0.5rem; margin-top:0.9rem; font-size:0.84rem; font-weight:500; color:var(--fg); }
  .chk input { width:auto; }
  .drop { margin-top:0.3rem; border:1.5px dashed var(--line); border-radius:10px; padding:0.85rem; display:flex; gap:1rem; align-items:center; cursor:pointer; }
  .drop:hover, .drop.over { border-color:var(--fg); }
  .drop .prev { width:116px; height:87px; border-radius:7px; background-color:#f0f0f0; background-image:var(--thumb, none); background-position:center; background-size:cover; flex:0 0 auto; border:1px solid var(--line); }
  .drop .txt { font-size:0.8rem; color:var(--muted); }

  .bar { display:flex; align-items:center; gap:1rem; padding:0.85rem 1.6rem; border-top:1px solid var(--line); background:var(--panel); }
  .save { background:var(--accent); color:#fff; border:0; border-radius:8px; padding:0.6rem 1.4rem; font:inherit; font-weight:600; cursor:pointer; }
  .save:disabled { opacity:0.55; cursor:default; }
  .del { background:none; border:0; color:var(--err); font:inherit; font-size:0.84rem; cursor:pointer; }
  .status { font-size:0.82rem; color:var(--muted); flex:1; min-width:0; }
  .status.ok { color:var(--ok); } .status.err { color:var(--err); }

  .preview { border-left:1px solid var(--line); background:var(--panel); display:flex; flex-direction:column; min-width:0; overflow:hidden; }
  .pv-head { height:46px; display:flex; align-items:center; justify-content:space-between; padding:0 1.1rem; border-bottom:1px solid var(--line); flex:0 0 auto; }
  .pv-label { font-size:0.66rem; letter-spacing:0.13em; text-transform:uppercase; color:var(--faint); }
  .pv-live { font-size:0.78rem; color:var(--muted); text-decoration:none; }
  .pv-live:hover { color:var(--fg); }
  .pv-scroll { overflow-y:auto; flex:1; background:#fff; }
  .pv { max-width:640px; margin:0 auto; padding:2.2rem 1.8rem 4rem; }
  .pv-hero { width:100%; aspect-ratio:4/3; border-radius:8px; background:#f0f0f0 center/cover; border:1px solid var(--line); margin-bottom:1.4rem; }
  .pv-title { margin:0; font-size:1.9rem; font-weight:700; letter-spacing:-0.035em; line-height:1.05; }
  .pv-lead { margin:0.8rem 0 0; color:var(--muted); font-size:1rem; }
  .pv-meta { margin:0.7rem 0 0; color:var(--faint); font-size:0.8rem; }
  .pv-prose { margin-top:1.6rem; font-size:0.98rem; line-height:1.8; }
  .pv-prose > *:first-child { margin-top:0; }
  .pv-prose p { margin:1.1rem 0 0; }
  .pv-prose h1 { font-size:1.5rem; margin:2rem 0 0; font-weight:700; letter-spacing:-0.02em; }
  .pv-prose h2 { font-size:1.3rem; margin:2.2rem 0 0; font-weight:700; letter-spacing:-0.02em; }
  .pv-prose h3 { font-size:1.08rem; margin:1.6rem 0 0; font-weight:600; }
  .pv-prose ul, .pv-prose ol { margin:1.1rem 0 0; padding-left:1.3rem; }
  .pv-prose li + li { margin-top:0.35rem; }
  .pv-prose a { color:inherit; text-decoration:underline; text-underline-offset:0.18em; text-decoration-color:var(--line); }
  .pv-prose blockquote { margin:1.4rem 0 0; padding-left:1.1rem; border-left:2px solid var(--line); color:var(--muted); }
  .pv-prose blockquote p { margin:0.3rem 0 0; }
  .pv-img { display:block; max-width:100%; height:auto; margin-top:1.2rem; border-radius:4px; }
  .pv-tw { overflow-x:auto; margin-top:1.2rem; }
  .pv-tw table { width:100%; border-collapse:collapse; font-size:0.88rem; }
  .pv-tw th, .pv-tw td { padding:0.45rem 0.7rem; border:1px solid var(--line); text-align:left; }
  .pv-prose hr { border:0; border-top:1px solid var(--line); margin:1.8rem 0; }
  .pv-empty { color:var(--faint); font-size:0.9rem; padding-top:1.5rem; }
  .pv-imgerr { display:block; margin-top:1.2rem; padding:0.6rem 0.8rem; border:1px dashed var(--err); border-radius:6px; color:var(--err); font-size:0.76rem; word-break:break-all; }

  [hidden] { display:none !important; }
  .only-project, .only-blog, .only-book, .only-doc { display:none; }
  body[data-type=project] .only-project { display:block; }
  body[data-type=blog] .only-blog { display:block; }
  body[data-type=book] .only-book { display:block; }
  body[data-type=project] .only-doc, body[data-type=blog] .only-doc { display:block; }

  .prev-book { width:72px; height:104px; aspect-ratio:auto; }
  .color-row { display:flex; align-items:center; gap:0.6rem; margin-top:0.3rem; }
  .color-row input[type=color] { width:42px; height:34px; padding:2px; border:1px solid var(--line); border-radius:8px; background:var(--panel); cursor:pointer; flex:0 0 auto; }
  .color-row input[type=text] { width:110px; flex:0 0 auto; font-family:ui-monospace,Menlo,monospace; }

  /* book live preview: a mini shelf scene */
  .bk-prev { display:flex; align-items:flex-end; justify-content:center; gap:2px; padding:2.2rem 1rem 1.6rem; background:linear-gradient(180deg,#1c1a17,#2a2723); border-radius:10px; min-height:280px; }
  .bk-prev .spine { width:42px; border-radius:1px 2px 2px 1px; display:flex; align-items:center; justify-content:center; color:#f4f1ea; box-shadow:inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 3px rgba(0,0,0,0.34); position:relative; }
  .bk-prev .spine .st { writing-mode:vertical-rl; text-orientation:mixed; display:flex; align-items:center; gap:0.8em; max-height:84%; white-space:nowrap; text-shadow:0 1px 1px rgba(0,0,0,0.4); }
  .bk-prev .spine .stt { font-weight:700; font-size:12px; letter-spacing:0.015em; overflow:hidden; text-overflow:ellipsis; }
  .bk-prev .spine .sta { font-weight:500; font-size:8px; opacity:0.7; overflow:hidden; text-overflow:ellipsis; }
  .bk-prev .ghost-spine { width:18px; height:78%; border-radius:1px; background:linear-gradient(180deg,#3a3733,#2d2a27); opacity:0.55; }
  .bk-cover-prev { width:150px; aspect-ratio:2/3; border-radius:2px 5px 5px 2px; background:#33384a center/cover; box-shadow:0 18px 30px -16px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(0,0,0,0.25); margin-left:14px; display:flex; align-items:flex-end; }
  .bk-cover-prev .cap { font-size:0.7rem; color:#fff; background:rgba(0,0,0,0.35); padding:0.3rem 0.45rem; border-radius:0 0 2px 5px; width:100%; }
  .bk-prev-meta { text-align:center; color:var(--muted); font-size:0.82rem; padding:1rem 1rem 0; }
  .bk-prev-meta b { color:var(--fg); font-weight:600; }

  @media (max-width:1080px) {
    .wrap { grid-template-columns:248px 1fr; }
    .preview { display:none; }
    #prevToggle { display:none; }
  }
</style></head>
<body data-type="blog">
  <header class="top">
    <div class="top-l">
      <span class="dot"></span>
      <h1>content studio</h1>
      <span class="sub">edits rebuild site · commit &amp; push to deploy</span>
    </div>
    <div class="top-r">
      <button type="button" class="ghost" id="prevToggle" onclick="togglePreview()">hide preview</button>
      <a class="ghost" href="/site/index.html" target="_blank">open site ↗</a>
    </div>
  </header>

  <div class="wrap">
    <aside class="side">
      <button class="new" onclick="newItem()">+ new entry</button>
      <div class="side-sec"><h2>blog</h2><div id="list-blog"></div></div>
      <div class="side-sec"><h2>projects</h2><div id="list-project"></div></div>
      <div class="side-sec"><h2>bookshelf</h2><div id="list-book"></div></div>
    </aside>

    <main class="editor">
      <div class="ed-scroll">
        <div class="tabs">
          <button type="button" id="tab-blog" class="on" onclick="setType('blog')">blog post</button>
          <button type="button" id="tab-project" onclick="setType('project')">project</button>
          <button type="button" id="tab-book" onclick="setType('book')">book</button>
        </div>

        <div class="only-blog import">
          <div class="import-row">
            <input type="text" id="impurl" placeholder="paste a public substack url to import…" />
            <button type="button" id="impbtn" onclick="importSub()">import</button>
          </div>
          <div class="hint">pulls title, body, images &amp; cover, converts to markdown, fills the form. review, then save.</div>
        </div>

        <div class="only-book import">
          <div class="import-row">
            <input type="text" id="lookupTitle" placeholder="book title…" />
            <input type="text" id="lookupAuthor" placeholder="author (optional)" style="flex:0 0 38%" />
            <button type="button" id="lookupBtn" onclick="lookupBook()">look up</button>
          </div>
          <div class="hint">finds the cover, author, page count &amp; spine colour automatically. review, then save.</div>
        </div>

        <form id="form" onsubmit="return false">
          <label>title</label>
          <input type="text" id="title" oninput="autoSlug()" placeholder="a clear title" />
          <label>slug</label>
          <input type="text" id="slug" placeholder="auto-from-title" />

          <div class="only-doc">
            <div class="row">
              <div><label>date</label><input type="date" id="date" /></div>
              <div class="only-blog"><label>read time</label><input type="text" id="read_time" placeholder="e.g. 6 min read" /></div>
            </div>
            <label>summary</label>
            <input type="text" id="summary" placeholder="one line shown under the title" />

            <div class="only-project">
              <label>order (featured sort)</label><input type="text" id="order" placeholder="1" />
              <label>stack (comma separated)</label><input type="text" id="stack" placeholder="python, pytorch" />
              <div class="row">
                <div><label>repo url</label><input type="text" id="repo" /></div>
                <div><label>demo url</label><input type="text" id="demo" /></div>
              </div>
              <label class="chk"><input type="checkbox" id="featured" /> feature on home page</label>
            </div>

            <label>card image <span class="faint">(writing grid thumbnail)</span></label>
            <div class="drop" id="drop">
              <div class="prev" id="prevImg"></div>
              <div class="txt" id="droptxt">drop an image or click to choose<br /><span class="faint">png / jpg / webp · shown 4:3 · saved on save</span></div>
              <input type="file" id="file" accept="image/png,image/jpeg,image/webp" hidden />
            </div>

            <div class="only-blog">
              <label>in-post image <span class="faint">(hero at top of article)</span></label>
              <div class="drop" id="bodyDrop">
                <div class="prev" id="bodyPrevImg"></div>
                <div class="txt" id="bodyDroptxt">drop an image or click to choose<br /><span class="faint">updates the first ![](…) in body · saved on save</span></div>
                <input type="file" id="bodyFile" accept="image/png,image/jpeg,image/webp" hidden />
              </div>
            </div>

            <label>body (markdown)</label>
            <textarea id="body" placeholder="# heading

write here — the preview updates as you type"></textarea>
          </div>

          <div class="only-book">
            <div class="row">
              <div><label>author</label><input type="text" id="author" placeholder="author name" /></div>
              <div><label>pages</label><input type="text" id="pages" placeholder="e.g. 320" /></div>
            </div>
            <div class="row">
              <div><label>shelf <span class="faint">(optional label)</span></label><input type="text" id="shelf" placeholder="e.g. ai &amp; what's next" /></div>
              <div><label>isbn</label><input type="text" id="isbn" placeholder="auto" /></div>
            </div>
            <label>cover <span class="faint">(auto-fetched · drop to replace)</span></label>
            <div class="drop" id="bookDrop">
              <div class="prev prev-book" id="bookPrevImg"></div>
              <div class="txt" id="bookDroptxt">look up a title above, or drop a cover<br /><span class="faint">png / jpg · spine colour recolours on save</span></div>
              <input type="file" id="bookFile" accept="image/png,image/jpeg,image/webp" hidden />
            </div>
            <label>spine colour</label>
            <div class="color-row">
              <input type="color" id="color" value="#33384a" oninput="onColorInput()" />
              <input type="text" id="colorHex" placeholder="#33384a" oninput="onColorHex()" />
              <span class="faint">pulled from the cover — tweak if you like</span>
            </div>
          </div>
        </form>
      </div>

      <div class="bar">
        <button type="button" class="save" id="save" onclick="save()">save</button>
        <button type="button" class="del" id="del" onclick="del()" hidden>delete</button>
        <span class="status" id="statusMsg"></span>
      </div>
    </main>

    <aside class="preview" id="previewPane">
      <div class="pv-head">
        <span class="pv-label">live preview</span>
        <a class="pv-live" id="pvLive" target="_blank" hidden>view live page ↗</a>
      </div>
      <div class="pv-scroll"><article class="pv" id="pv"></article></div>
    </aside>
  </div>

<script>
  let type = "blog", editingSlug = null, imageDataUrl = null, bodyImageDataUrl = null, currentImageUrl = null, currentBodyImageUrl = null, listCache = { blog: [], project: [], book: [] }, pvNonce = Date.now();
  let coverDataUrl = null, currentCoverUrl = null, existingCoverFile = null;
  const $ = (id) => document.getElementById(id);
  const val = (id) => { const e = $(id); return e ? e.value.trim() : ""; };

  function cssUrl(u) {
    if (!u) return "none";
    return 'url("' + String(u).replace(/"/g, "%22") + '")';
  }
  function setThumbStyle(el, url) {
    if (!el) return;
    el.style.setProperty("--thumb", cssUrl(url));
  }

  // ---- client-side markdown render (mirrors scripts/build.mjs subset) ----
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function normImg(s) {
    if (/^(https?:|data:)/.test(s)) return s;
    var u = s;
    if (s.charAt(0) !== "/") { if (s.indexOf("./") === 0) u = "/" + s.slice(2); else if (s.indexOf("images/") === 0) u = "/" + s; }
    // local files keep a stable url while typing but bust the browser cache after each
    // import/save/load, so a previously-cached 404 (file not yet on disk) can't stick
    if (u.charAt(0) === "/") u += (u.indexOf("?") < 0 ? "?" : "&") + "v=" + pvNonce;
    return u;
  }
  function externalLinkAttrs(h) {
    if (/^https?:\\/\\//i.test(String(h).trim())) return ' target="_blank" rel="noopener noreferrer"';
    return "";
  }
  function inlineMd(t) {
    return esc(t)
      .replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, function (m, a, s) { return '<img class="pv-img" src="' + normImg(s) + '" alt="' + a + '">'; })
      .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, function (m, l, h) { return '<a href="' + h + '"' + externalLinkAttrs(h) + '>' + l + '</a>'; })
      .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
      .replace(/_([^_]+)_/g, '<em>$1</em>');
  }
  function renderMd(md) {
    var lines = String(md || "").split(/\\r?\\n/), out = [], para = [], ul = [], ol = [], bq = [], tbl = [];
    function fp() { if (para.length) { var t = para.join(" ").trim(); if (t) out.push("<p>" + inlineMd(t) + "</p>"); para = []; } }
    function ful() { if (ul.length) { out.push("<ul>" + ul.map(function (i) { return "<li>" + inlineMd(i) + "</li>"; }).join("") + "</ul>"); ul = []; } }
    function fol() { if (ol.length) { out.push("<ol>" + ol.map(function (i) { return "<li>" + inlineMd(i) + "</li>"; }).join("") + "</ol>"); ol = []; } }
    function fbq() { if (bq.length) { out.push("<blockquote>" + bq.map(function (l) { return "<p>" + inlineMd(l) + "</p>"; }).join("") + "</blockquote>"); bq = []; } }
    function ftbl() {
      if (!tbl.length) return;
      var hs = tbl[0].split("|").map(function (s) { return s.trim(); }).filter(Boolean);
      var head = hs.map(function (x) { return "<th>" + inlineMd(x) + "</th>"; }).join("");
      var rows = tbl.slice(2).filter(function (r) { return r.trim(); }).map(function (r) {
        return "<tr>" + r.split("|").map(function (s) { return s.trim(); }).filter(Boolean).map(function (c) { return "<td>" + inlineMd(c) + "</td>"; }).join("") + "</tr>";
      }).join("");
      out.push('<div class="pv-tw"><table><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div>'); tbl = [];
    }
    function flushAll() { fp(); ful(); fol(); fbq(); }
    for (var k = 0; k < lines.length; k++) {
      var line = lines[k].trim();
      if (line.charAt(0) === "|" && line.charAt(line.length - 1) === "|") { flushAll(); tbl.push(line); continue; } else if (tbl.length) { ftbl(); }
      if (!line) { flushAll(); continue; }
      if (line.indexOf("> ") === 0) { fp(); ful(); fol(); bq.push(line.slice(2).trim()); continue; }
      if (/^(-{3,}|\\*{3,}|_{3,})$/.test(line)) { flushAll(); out.push("<hr>"); continue; }
      if (line.indexOf("### ") === 0) { flushAll(); out.push("<h3>" + inlineMd(line.slice(4).trim()) + "</h3>"); continue; }
      if (line.indexOf("## ") === 0) { flushAll(); out.push("<h2>" + inlineMd(line.slice(3).trim()) + "</h2>"); continue; }
      if (line.indexOf("# ") === 0) { flushAll(); out.push("<h1>" + inlineMd(line.slice(2).trim()) + "</h1>"); continue; }
      if (line.indexOf("- ") === 0) { fp(); fol(); ul.push(line.slice(2).trim()); continue; }
      if (/^\\d+\\.\\s/.test(line)) { fp(); ful(); ol.push(line.replace(/^\\d+\\.\\s/, "").trim()); continue; }
      para.push(line);
    }
    flushAll(); ftbl();
    return out.join("\\n");
  }

  function updatePreview() {
    if (type === "book") return updateBookPreview();
    var title = val("title") || "untitled";
    var summary = val("summary");
    var body = $("body").value;
    var bodyForPreview = body;
    if (bodyImageDataUrl) {
      bodyForPreview = /!\\[[^\\]]*\\]\\([^)]+\\)/.test(bodyForPreview)
        ? bodyForPreview.replace(/!\\[[^\\]]*\\]\\([^)]+\\)/, "![](" + bodyImageDataUrl + ")")
        : "![](" + bodyImageDataUrl + ")\\n\\n" + bodyForPreview;
    }
    var meta = type === "blog"
      ? [val("date"), val("read_time")].filter(Boolean).join(" · ")
      : [val("date")].filter(Boolean).join(" · ");
    var img = imageDataUrl || currentImageUrl;
    var bodyImg = bodyImageDataUrl || currentBodyImageUrl;
    var html = "";
    if (img) html += '<div class="pv-hero" style="background-image:' + cssUrl(img) + '"></div>';
    else if (bodyImg) html += '<div class="pv-hero" style="background-image:' + cssUrl(bodyImg) + '"></div>';
    html += '<h1 class="pv-title">' + esc(title.toLowerCase()) + '</h1>';
    if (summary) html += '<p class="pv-lead">' + esc(summary) + '</p>';
    if (meta) html += '<p class="pv-meta">' + esc(meta.toLowerCase()) + '</p>';
    if (bodyForPreview.trim()) html += '<div class="pv-prose">' + renderMd(bodyForPreview) + '</div>';
    else html += '<div class="pv-empty">start writing — your post renders here.</div>';
    $("pv").innerHTML = html;
    // surface the exact url of any image that fails to load, instead of a silent broken icon
    $("pv").querySelectorAll(".pv-img").forEach(function (im) {
      im.addEventListener("error", function () {
        const s = document.createElement("span");
        s.className = "pv-imgerr";
        s.textContent = "⚠ image didn't load: " + im.getAttribute("src");
        im.replaceWith(s);
      });
    });
  }
  function lum(hex) {
    const h = String(hex || "").replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  function updateBookPreview() {
    var title = val("title") || "untitled";
    var author = val("author");
    var pages = val("pages");
    var color = val("colorHex") || "#33384a";
    var cover = coverDataUrl || currentCoverUrl;
    var sc = lum(color) > 0.58 ? "#23211c" : "#f4f1ea";
    // spine height scales a touch with page count, like the real shelf
    var p = parseInt(String(pages).replace(/\\D/g, ""), 10) || 300;
    var h = Math.round(150 + Math.min(p, 720) * 0.05);
    var html = '<div class="bk-prev">'
      + '<span class="ghost-spine"></span>'
      + '<span class="spine" style="height:' + h + 'px;background:' + esc(color) + ';color:' + sc + '">'
      + '<span class="st"><span class="stt">' + esc(title) + '</span>'
      + (author ? '<span class="sta" style="color:' + sc + '">' + esc(author) + '</span>' : '')
      + '</span></span>'
      + '<span class="bk-cover-prev" style="' + (cover ? 'background-image:' + cssUrl(cover) : 'background:' + esc(color)) + '">'
      + (cover ? '' : '<span class="cap">' + esc(title) + '</span>')
      + '</span>'
      + '<span class="ghost-spine"></span>'
      + '</div>'
      + '<div class="bk-prev-meta"><b>' + esc(title.toLowerCase()) + '</b>'
      + (author ? ' · ' + esc(author.toLowerCase()) : '')
      + (pages ? ' · ' + esc(String(pages)) + ' pages' : '') + '</div>';
    $("pv").innerHTML = html;
  }
  var pvTimer;
  function schedulePreview() { clearTimeout(pvTimer); pvTimer = setTimeout(updatePreview, 110); }

  function setType(t) {
    type = t; document.body.dataset.type = t;
    $("tab-blog").classList.toggle("on", t === "blog");
    $("tab-project").classList.toggle("on", t === "project");
    $("tab-book").classList.toggle("on", t === "book");
    setLiveLink(); updatePreview();
  }
  function slugify(v) { return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function autoSlug() { const s = $("slug"); if (!s.dataset.touched) s.value = slugify(val("title")); schedulePreview(); }

  function setLiveLink() {
    const el = $("pvLive");
    if (type === "book") { el.href = "/site/about/index.html#bookshelf"; el.hidden = false; return; }
    if (editingSlug) { el.href = "/site/" + (type === "blog" ? "writing" : "work") + "/" + editingSlug + ".html"; el.hidden = false; }
    else el.hidden = true;
  }

  function clearForm() {
    editingSlug = null; imageDataUrl = null; bodyImageDataUrl = null; currentImageUrl = null; currentBodyImageUrl = null;
    coverDataUrl = null; currentCoverUrl = null; existingCoverFile = null;
    ["title","slug","summary","read_time","order","stack","repo","demo","body","impurl","author","pages","shelf","isbn","lookupTitle","lookupAuthor"].forEach(function (id) { const e = $(id); if (e) e.value = ""; });
    $("slug").dataset.touched = "";
    $("featured").checked = false;
    $("date").value = new Date().toISOString().slice(0, 10);
    setColor("#33384a");
    setPrevImg(null);
    setBodyPrevImg(null);
    setBookPrevImg(null);
    $("del").hidden = true;
    setLiveLink(); setStatus(""); markSel(null); updatePreview();
  }
  function newItem() { clearForm(); $(type === "book" ? "lookupTitle" : "title").focus(); }

  function setBookPrevImg(url) {
    setThumbStyle($("bookPrevImg"), url);
    $("bookDroptxt").firstChild.textContent = url ? "cover set — drop to replace" : "look up a title above, or drop a cover";
  }
  function setColor(hex) {
    hex = (hex || "#33384a").trim();
    if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) return;
    if (hex[0] !== "#") hex = "#" + hex;
    $("color").value = hex.toLowerCase();
    $("colorHex").value = hex.toLowerCase();
  }
  function onColorInput() { $("colorHex").value = $("color").value; schedulePreview(); }
  function onColorHex() {
    const v = val("colorHex");
    if (/^#?[0-9a-fA-F]{6}$/.test(v)) { $("color").value = (v[0] === "#" ? v : "#" + v).toLowerCase(); }
    schedulePreview();
  }

  function setPrevImg(url) {
    setThumbStyle($("prevImg"), url);
    $("droptxt").firstChild.textContent = url ? "image set — click to replace" : "drop an image or click to choose";
  }
  function setBodyPrevImg(url) {
    setThumbStyle($("bodyPrevImg"), url);
    $("bodyDroptxt").firstChild.textContent = url ? "image set — click to replace" : "drop an image or click to choose";
  }
  function firstBodyImage(body) {
    const m = String(body || "").match(/!\\[[^\\]]*\\]\\(([^)]+)\\)/);
    return m ? m[1].trim().replace(/^\\.?\\//, "") : null;
  }
  function setStatus(msg, cls) { const s = $("statusMsg"); s.textContent = msg || ""; s.className = "status " + (cls || ""); }
  function togglePreview() {
    document.body.classList.toggle("no-preview");
    $("prevToggle").textContent = document.body.classList.contains("no-preview") ? "show preview" : "hide preview";
  }

  const drop = $("drop"), file = $("file");
  drop.onclick = () => file.click();
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer.files[0]) readImg(e.dataTransfer.files[0]); };
  file.onchange = () => { if (file.files[0]) readImg(file.files[0]); };
  function readImg(f) { const r = new FileReader(); r.onload = () => { imageDataUrl = r.result; setPrevImg(imageDataUrl); updatePreview(); }; r.readAsDataURL(f); }

  const bodyDrop = $("bodyDrop"), bodyFile = $("bodyFile");
  bodyDrop.onclick = () => bodyFile.click();
  bodyDrop.ondragover = (e) => { e.preventDefault(); bodyDrop.classList.add("over"); };
  bodyDrop.ondragleave = () => bodyDrop.classList.remove("over");
  bodyDrop.ondrop = (e) => { e.preventDefault(); bodyDrop.classList.remove("over"); if (e.dataTransfer.files[0]) readBodyImg(e.dataTransfer.files[0]); };
  bodyFile.onchange = () => { if (bodyFile.files[0]) readBodyImg(bodyFile.files[0]); };
  function readBodyImg(f) {
    const r = new FileReader();
    r.onload = () => {
      bodyImageDataUrl = r.result;
      setBodyPrevImg(bodyImageDataUrl);
      updatePreview();
    };
    r.readAsDataURL(f);
  }

  const bookDrop = $("bookDrop"), bookFile = $("bookFile");
  bookDrop.onclick = () => bookFile.click();
  bookDrop.ondragover = (e) => { e.preventDefault(); bookDrop.classList.add("over"); };
  bookDrop.ondragleave = () => bookDrop.classList.remove("over");
  bookDrop.ondrop = (e) => { e.preventDefault(); bookDrop.classList.remove("over"); if (e.dataTransfer.files[0]) readCoverImg(e.dataTransfer.files[0]); };
  bookFile.onchange = () => { if (bookFile.files[0]) readCoverImg(bookFile.files[0]); };
  function readCoverImg(f) {
    const r = new FileReader();
    r.onload = () => { coverDataUrl = r.result; setBookPrevImg(coverDataUrl); updatePreview(); };
    r.readAsDataURL(f);
  }

  async function lookupBook() {
    const title = val("lookupTitle");
    if (!title) { setStatus("enter a book title first", "err"); return; }
    const b = $("lookupBtn"); b.disabled = true; b.textContent = "looking…"; setStatus("searching open library…");
    try {
      const r = await fetch("/api/book-lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, author: val("lookupAuthor") }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      const f = j.fields;
      const set = (id, v) => { const e = $(id); if (e) e.value = v == null ? "" : v; };
      set("title", f.title); set("author", f.author); set("pages", f.pages); set("isbn", f.isbn);
      $("slug").value = slugify(f.title); $("slug").dataset.touched = "1";
      if (f.color) setColor(f.color);
      if (j.coverDataUrl) { coverDataUrl = j.coverDataUrl; setBookPrevImg(coverDataUrl); }
      setStatus(j.coverDataUrl ? "found ✓ — review and save" : "found, but no cover — drop one in", j.coverDataUrl ? "ok" : "err");
      updatePreview();
    } catch (e) { setStatus("lookup failed: " + (e.message || e), "err"); }
    b.disabled = false; b.textContent = "look up";
  }

  function markSel(slug) { document.querySelectorAll(".item").forEach(function (el) { el.classList.toggle("sel", el.dataset.slug === slug); }); }

  async function loadList() {
    const data = await (await fetch("/api/list")).json();
    listCache = data;
    ["blog", "project", "book"].forEach(function (t) {
      $("list-" + t).innerHTML = (data[t] || []).map(function (it) {
        const bg = it.image ? cssUrl(it.image + "?t=" + Date.now()) : "none";
        const sub = t === "book" ? esc(it.author || "") : (it.date || "");
        return \`<button class="item" data-slug="\${esc(it.slug)}" onclick="loadItem('\${t}','\${it.slug}')">
          <span class="th" style="--thumb:\${bg}"></span>
          <span><span class="t">\${esc(it.title)}</span><br /><span class="d">\${sub}</span></span>
        </button>\`;
      }).join("") || '<div class="d" style="padding:0 1.1rem 0.5rem;color:#bbb">none yet</div>';
    });
  }

  async function loadItem(t, slug) {
    if (t === "book") return loadBook(slug);
    setType(t);
    const res = await (await fetch("/api/item?type=" + t + "&slug=" + encodeURIComponent(slug))).json();
    clearForm();
    editingSlug = slug;
    const a = res.attrs || {};
    const set = (id, v) => { const e = $(id); if (e) e.value = v || ""; };
    set("title", a.title); set("slug", a.slug || slug); set("summary", a.summary); set("date", a.date);
    set("read_time", a.read_time); set("order", a.order); set("stack", a.stack);
    set("repo", a.repo); set("demo", a.demo); set("body", res.body);
    $("slug").dataset.touched = "1";
    $("featured").checked = a.featured === "true";
    const found = (listCache[t] || []).find(function (x) { return x.slug === slug; });
    if (found && found.image) { currentImageUrl = found.image + "?t=" + Date.now(); setPrevImg(currentImageUrl); }
    const bodyImg = firstBodyImage(res.body);
    if (bodyImg) { currentBodyImageUrl = "/" + bodyImg + "?t=" + Date.now(); setBodyPrevImg(currentBodyImageUrl); }
    $("del").hidden = false;
    pvNonce = Date.now();
    setLiveLink(); markSel(slug); setStatus(""); updatePreview();
  }

  async function loadBook(slug) {
    setType("book");
    const res = await (await fetch("/api/book?slug=" + encodeURIComponent(slug))).json();
    clearForm();
    const b = res.book || {};
    editingSlug = slug;
    const set = (id, v) => { const e = $(id); if (e) e.value = v == null ? "" : v; };
    set("title", b.title); set("slug", b.slug || slug); set("author", b.author);
    set("pages", b.pages); set("shelf", b.shelf); set("isbn", b.isbn);
    $("slug").dataset.touched = "1";
    setColor(b.color || "#33384a");
    existingCoverFile = b.coverFile || null;
    if (b.coverFile) { currentCoverUrl = "/content/preview/" + b.coverFile + "?t=" + Date.now(); setBookPrevImg(currentCoverUrl); }
    $("del").hidden = false;
    pvNonce = Date.now();
    setLiveLink(); markSel(slug); setStatus(""); updatePreview();
  }

  async function importSub() {
    const url = val("impurl");
    if (!url) { setStatus("paste a substack url first", "err"); return; }
    const b = $("impbtn"); b.disabled = true; b.textContent = "importing…"; setStatus("fetching & converting…");
    try {
      const r = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setType("blog"); clearForm();
      const f = j.fields;
      const set = (id, v) => { const e = $(id); if (e) e.value = v || ""; };
      set("title", f.title); set("slug", f.slug); set("summary", f.summary); set("date", f.date); set("read_time", f.read_time); set("body", j.body);
      $("slug").dataset.touched = "1";
      if (j.cardImage) { currentImageUrl = j.cardImage; setPrevImg(j.cardImage); }
      pvNonce = Date.now();
      setStatus("imported ✓ — review and save", "ok"); updatePreview();
    } catch (e) { setStatus("import failed: " + (e.message || e), "err"); }
    b.disabled = false; b.textContent = "import";
  }

  async function saveBook() {
    const fields = {};
    ["title","slug","author","pages","shelf","isbn"].forEach(function (id) { fields[id] = val(id); });
    fields.color = val("colorHex") || val("color");
    if (!fields.title) { setStatus("title is required", "err"); return; }
    const btn = $("save"); btn.disabled = true; btn.textContent = "saving…"; setStatus("saving & rebuilding shelf…");
    try {
      const r = await fetch("/api/book-save", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, coverDataUrl, existingCoverFile }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "save failed");
      editingSlug = j.slug; coverDataUrl = null; existingCoverFile = j.coverFile || existingCoverFile;
      if (j.color) setColor(j.color);
      const bad = j.build && !j.build.ok;
      setStatus(bad ? "saved, but the build errored — check the terminal" : "saved & rebuilt ✓ — commit & push to deploy", bad ? "err" : "ok");
      $("del").hidden = false;
      await loadList(); markSel(j.slug);
      const found = (listCache.book || []).find(function (x) { return x.slug === j.slug; });
      if (found && found.image) { currentCoverUrl = found.image + "?t=" + Date.now(); setBookPrevImg(currentCoverUrl); }
      pvNonce = Date.now();
      setLiveLink(); updatePreview();
    } catch (e) { setStatus(String(e.message || e), "err"); }
    btn.disabled = false; btn.textContent = "save";
  }

  async function save() {
    if (type === "book") return saveBook();
    const fields = {};
    ["title","slug","summary","date","read_time","order","stack","repo","demo"].forEach(function (id) { fields[id] = val(id); });
    fields.featured = $("featured").checked;
    if (!fields.title) { setStatus("title is required", "err"); return; }
    const btn = $("save"); btn.disabled = true; btn.textContent = "saving…"; setStatus("writing files & rebuilding…");
    try {
      const r = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, fields, body: $("body").value, imageDataUrl, bodyImageDataUrl }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "save failed");
      editingSlug = j.slug; imageDataUrl = null; bodyImageDataUrl = null;
      if (j.body) $("body").value = j.body;
      const bad = j.build && !j.build.ok;
      setStatus(bad ? "saved, but the build errored — check the terminal" : "saved & rebuilt ✓ — commit & push to deploy", bad ? "err" : "ok");
      $("del").hidden = false;
      await loadList(); markSel(j.slug);
      const found = (listCache[type] || []).find(function (x) { return x.slug === j.slug; });
      currentImageUrl = found && found.image ? found.image + "?t=" + Date.now() : currentImageUrl;
      setPrevImg(currentImageUrl);
      const bodyImg = firstBodyImage($("body").value);
      currentBodyImageUrl = bodyImg ? "/" + bodyImg + "?t=" + Date.now() : currentBodyImageUrl;
      setBodyPrevImg(currentBodyImageUrl);
      pvNonce = Date.now();
      setLiveLink(); updatePreview();
    } catch (e) { setStatus(String(e.message || e), "err"); }
    btn.disabled = false; btn.textContent = "save";
  }

  async function del() {
    if (!editingSlug || !confirm("delete " + editingSlug + "?")) return;
    setStatus("deleting…");
    if (type === "book") {
      const r = await fetch("/api/book-delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: editingSlug }) });
      const j = await r.json();
      if (j.ok) { clearForm(); setStatus("deleted ✓", "ok"); await loadList(); } else setStatus(j.error || "failed", "err");
      return;
    }
    const r = await fetch("/api/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, slug: editingSlug }) });
    const j = await r.json();
    if (j.ok) { clearForm(); setStatus("deleted ✓", "ok"); await loadList(); } else setStatus(j.error || "failed", "err");
  }

  // live preview wiring + shortcuts
  ["title","summary","body","date","read_time","stack","author","pages"].forEach(function (id) { const e = $(id); if (e) e.addEventListener("input", schedulePreview); });
  $("slug").addEventListener("input", function (e) { e.target.dataset.touched = "1"; });
  ["lookupTitle","lookupAuthor"].forEach(function (id) {
    const e = $(id); if (e) e.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); lookupBook(); } });
  });
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  });

  if (window.innerWidth <= 1080) document.body.classList.add("no-preview");
  clearForm(); loadList();
</script>
</body></html>`;
