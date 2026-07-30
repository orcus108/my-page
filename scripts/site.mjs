import { promises as fs } from "node:fs";
import path from "node:path";
import { lightboxStyles, lightboxScriptBody } from "./lightbox.mjs";
import { copyFonts, fontFaceCss, fontPreloads } from "./lib/fonts.mjs";
import { contentHash, minifyCss, minifyJs } from "./lib/minify.mjs";
import { collectMarkdownImages, ImagePipeline } from "./lib/optimize-image.mjs";
import { SITE_CONFIG, resolveSiteUrl } from "./lib/site-config.mjs";
import { buildPersSite } from "./pers.mjs";

const EMAIL = SITE_CONFIG.email;
const X_URL = SITE_CONFIG.profiles.x;
const GH_URL = SITE_CONFIG.profiles.github;
const SUBSTACK_URL = SITE_CONFIG.profiles.substack;
const SITE_TITLE = SITE_CONFIG.name;
const SITE_DESCRIPTION = SITE_CONFIG.description;
const TWITTER_HANDLE = SITE_CONFIG.twitterHandle;
const SITE_URL = resolveSiteUrl();
const PERSON_ID = `${SITE_URL}/#person`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const DEFAULT_SOCIAL_IMAGE = "assets/portrait.webp";

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalCapitalization(value) {
  let text = String(value ?? "");
  text = text.replace(/(^\s*|[.!?]["'”’)]*\s+)([a-z])/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
  const terms = [
    [/\bai\b/gi, "AI"],
    [/\bllms\b/gi, "LLMs"],
    [/\bllm\b/gi, "LLM"],
    [/\bindia\b/gi, "India"],
    [/\biit madras\b/gi, "IIT Madras"],
    [/\bmacos\b/gi, "macOS"],
    [/\bopenai\b/gi, "OpenAI"],
    [/\bgithub\b/gi, "GitHub"],
    [/\bvercel\b/gi, "Vercel"],
    [/\bnotion\b/gi, "Notion"],
    [/\bgmail\b/gi, "Gmail"],
    [/\bpytorch\b/gi, "PyTorch"],
    [/\bkaggle\b/gi, "Kaggle"],
    [/\bfastapi\b/gi, "FastAPI"],
    [/\bhugging face\b/gi, "Hugging Face"],
    [/\byoutube\b/gi, "YouTube"],
    [/\bsakhi\b/gi, "Sakhi"],
    [/\bi\b/g, "I"],
  ];
  for (const [pattern, replacement] of terms) text = text.replace(pattern, replacement);
  text = text.replace(/\b(vs|e\.g|i\.e|etc)\. ([A-Z])/g, (_match, abbreviation, letter) => `${abbreviation}. ${letter.toLowerCase()}`);
  return text;
}

function normalCapitalizationHtml(html) {
  return String(html ?? "")
    .split(/(<[^>]+>)/g)
    .map((part) => (part.startsWith("<") ? part : normalCapitalization(part)))
    .join("");
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// plain-text excerpt from a markdown body, for featured entries
function excerptOf(body, max = 165) {
  const text = (body || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s.*$/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>|-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).trim() + "…";
}

function stripMarkdown(body) {
  return (body || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function metaDescription(value, fallback = SITE_DESCRIPTION) {
  const text = stripMarkdown(value || fallback);
  if (text.length <= 158) return text;
  const cut = text.slice(0, 155);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 90 ? lastSpace : cut.length).trim()}...`;
}

function absoluteUrl(input = "/") {
  const raw = String(input || "/").trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw === "/" || raw === "") return `${SITE_URL}/`;
  const cleaned = raw.replace(/^(\.\.\/)+/, "").replace(/^\.?\//, "");
  return `${SITE_URL}/${cleaned}`;
}

function canonicalPath(pathname = "/") {
  const raw = String(pathname || "/").trim();
  if (raw === "/" || raw === "") return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function isoDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function isoDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}

function latestIsoDate(values) {
  const dates = values
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  return dates[0] ? dates[0].toISOString().slice(0, 10) : isoDate(new Date());
}

function safeJson(data) {
  return JSON.stringify(data)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function jsonLdScript(data) {
  const items = Array.isArray(data) ? data.filter(Boolean) : [data].filter(Boolean);
  if (!items.length) return "";
  return `    <script type="application/ld+json">${safeJson(
    items.length === 1 ? items[0] : { "@context": "https://schema.org", "@graph": items }
  )}</script>`;
}

function personSchema() {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: SITE_TITLE,
    url: absoluteUrl("/"),
    email: EMAIL,
    sameAs: [X_URL, GH_URL, SUBSTACK_URL],
    affiliation: {
      "@type": "CollegeOrUniversity",
      name: "IIT Madras",
    },
    knowsAbout: [
      "AI products",
      "local-first software",
      "product design",
      "healthcare technology",
      "India-first markets",
    ],
    description: SITE_DESCRIPTION,
  };
}

function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl("/"),
    name: SITE_TITLE,
    alternateName: ["Vedant Misra portfolio", "Vedant Misra personal site"],
    description: SITE_DESCRIPTION,
    publisher: { "@id": PERSON_ID },
    inLanguage: "en",
  };
}

function webpageSchema({ type = "WebPage", path = "/", title, description, image }) {
  const url = absoluteUrl(path);
  return {
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": PERSON_ID },
    primaryImageOfPage: image
      ? {
          "@type": "ImageObject",
          url: absoluteUrl(image),
        }
      : undefined,
    inLanguage: "en",
  };
}

function breadcrumbSchema(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

function itemListSchema(items) {
  return {
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(item.path),
      name: item.name,
    })),
  };
}

function seoHead({
  root,
  title,
  description,
  path = "/",
  image = DEFAULT_SOCIAL_IMAGE,
  imageAlt = SITE_TITLE,
  ogType = "website",
  publishedTime = "",
  modifiedTime = "",
  articleSection = "",
  structuredData = [],
}) {
  const canonical = absoluteUrl(path);
  const img = absoluteUrl(image || DEFAULT_SOCIAL_IMAGE);
  const desc = metaDescription(description);
  const jsonLd = jsonLdScript(structuredData);
  const published = isoDateTime(publishedTime);
  const modified = isoDateTime(modifiedTime);
  return `
    <meta name="description" content="${escapeHtml(desc)}" />
    <meta name="author" content="${escapeHtml(SITE_TITLE)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <link rel="icon" href="${root}favicon.svg" type="image/svg+xml" />
    <meta property="og:site_name" content="${escapeHtml(SITE_TITLE)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(desc)}" />
    <meta property="og:type" content="${escapeHtml(ogType)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(img)}" />
    <meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />
    <meta property="og:locale" content="en_US" />
    ${published ? `<meta property="article:published_time" content="${escapeHtml(published)}" />` : ""}
    ${modified ? `<meta property="article:modified_time" content="${escapeHtml(modified)}" />` : ""}
    ${articleSection ? `<meta property="article:section" content="${escapeHtml(articleSection)}" />` : ""}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:creator" content="${escapeHtml(TWITTER_HANDLE)}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(desc)}" />
    <meta name="twitter:image" content="${escapeHtml(img)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />
${jsonLd}`;
}

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function writeFavicon(root) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0c0c0c"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="700" fill="#ffffff">vm</text></svg>`;
  await fs.writeFile(path.join(root, "favicon.svg"), svg, "utf8");
}

async function writeRobots(root) {
  const robots = `User-agent: *
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: GPTBot
Allow: /

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;
  await fs.writeFile(path.join(root, "robots.txt"), robots, "utf8");
}

async function writeIndexNowKey(root) {
  await fs.writeFile(
    path.join(root, `${SITE_CONFIG.indexNowKey}.txt`),
    SITE_CONFIG.indexNowKey,
    "utf8"
  );
}

async function writeSitemap(root, entries) {
  const unique = new Map();
  for (const entry of entries) {
    if (!entry || !entry.path) continue;
    unique.set(absoluteUrl(entry.path), entry);
  }
  const urls = [...unique.entries()]
    .map(([loc, entry]) => {
      const images = [...new Set(entry.images || [])]
        .filter(Boolean)
        .map((image) => `<image:image><image:loc>${xmlEscape(absoluteUrl(image))}</image:loc></image:image>`)
        .join("");
      const lastmod = entry.lastmod ? `<lastmod>${xmlEscape(isoDate(entry.lastmod))}</lastmod>` : "";
      return `  <url><loc>${xmlEscape(loc)}</loc>${lastmod}${images}</url>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;
  await fs.writeFile(path.join(root, "sitemap.xml"), xml, "utf8");
}

function shelfScript() {
  return `
    <script>
      (function () {
        var DWELL = 450;
        var books = Array.prototype.slice.call(document.querySelectorAll(".book"));
        var shelves = document.querySelector(".shelves");
        if (!shelves) return;
        var current = null, timer = null, presentedAt = 0, usingPointer = false;

        function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
        function clearLean() {
          books.forEach(function (o) { o.classList.remove("lean-l", "lean-r"); });
        }
        function setLean(b) {
          clearLean();
          if (!b || !b.parentElement) return;
          var sibs = Array.prototype.slice.call(b.parentElement.children)
            .filter(function (n) { return n.classList && n.classList.contains("book"); });
          var i = sibs.indexOf(b);
          // the book to the left leans right into the gap; the one to the right leans left
          if (i > 0) sibs[i - 1].classList.add("lean-r");
          if (i < sibs.length - 1) sibs[i + 1].classList.add("lean-l");
        }
        function present(b) {
          if (current === b) return;
          if (current) {
            current.classList.remove("is-presenting");
          }
          current = b;
          if (b) {
            b.classList.add("is-presenting");
            presentedAt = Date.now();
            setLean(b);
          } else {
            clearLean();
          }
        }
        function close() { clearTimer(); present(null); }

        document.addEventListener("pointerdown", function () {
          usingPointer = true;
          setTimeout(function () { usingPointer = false; }, 450);
        }, true);

        books.forEach(function (b) {
          // the pull-out fires only on a deliberate dwell, never on a casual pass
          b.addEventListener("mouseenter", function () {
            clearTimer();
            timer = setTimeout(function () { present(b); }, DWELL);
          });
          b.addEventListener("mouseleave", clearTimer);
          b.addEventListener("click", function (e) {
            e.stopPropagation();
            clearTimer();
            if (current === b) {
              if (Date.now() - presentedAt > 350) close();
            } else {
              present(b);
            }
          });
          b.addEventListener("focus", function () { if (!usingPointer) present(b); });
        });

        shelves.addEventListener("mouseleave", close);
        document.addEventListener("click", function (e) {
          if (!e.target.closest(".book")) close();
        });
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape") close();
        });
      })();
    </script>`;
}

export function splitProjectBody(body) {
  const match = body.match(/^([\s\S]*?)^## tech stack\s*$/im);
  if (!match) return { story: body.trim(), technical: "" };
  return {
    story: match[1].trim(),
    technical: body.slice(match[0].length).trim(),
  };
}

function styles() {
  return `${fontFaceCss()}
      :root {
        --bg: #ffffff;
        --fg: #0c0c0c;
        --muted: #6d6d6d;
        --faint: #9a9a9a;
        --line: #ececec;
        --topbar-bg: rgba(255, 255, 255, 0.82);
        --shelf-line: #c4b8a8;
        --shelf-shadow: rgba(0, 0, 0, 0.35);
        --shelf-wood: #e6ddd2;
        --shelf-wood-deep: #cfc3b4;
        --shelf-wood-grain: rgba(92, 72, 52, 0.07);
        --shelf-back: #f0ebe4;
        --portrait-filter: none;
        --portrait-blend: multiply;
        --font: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
        --max: 1080px;
        --pad: clamp(1.5rem, 5vw, 4rem);
      }

      [data-theme="dark"] {
        --bg: #0c0c0c;
        --fg: #f2f2f2;
        --muted: #a3a3a3;
        --faint: #6a6a6a;
        --line: #262626;
        --topbar-bg: rgba(12, 12, 12, 0.72);
        --shelf-line: #3d3530;
        --shelf-shadow: rgba(0, 0, 0, 0.65);
        --shelf-wood: #2a2420;
        --shelf-wood-deep: #1a1614;
        --shelf-wood-grain: rgba(255, 255, 255, 0.04);
        --shelf-back: #141210;
        /* the portrait is black ink on white; inverting it looks like a creepy negative,
           so in dark mode show it as-is on a light card instead (see .portrait override) */
        --portrait-filter: none;
        --portrait-blend: normal;
      }

      * { box-sizing: border-box; }

      html { scroll-behavior: auto; }

      body {
        margin: 0;
        font-family: var(--font);
        background: var(--bg);
        color: var(--fg);
        line-height: 1.7;
        font-size: 0.9375rem;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
        transition: background-color 0.25s ease, color 0.25s ease;
      }

      a { color: inherit; text-decoration: none; }

      .wrap {
        max-width: var(--max);
        margin: 0 auto;
        padding: 0 var(--pad);
      }

      /* thesis-led home hero */
      .hero {
        min-height: 100vh;
        min-height: 100svh;
        display: flex;
        flex-direction: column;
        background: var(--bg);
      }
      .hero-inner {
        width: min(100%, 1440px);
        flex: 1 1 auto;
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 2rem;
        padding: 1.75rem var(--pad) 2.25rem;
        margin: 0 auto;
      }

      .hero-identity {
        color: var(--muted);
        font-size: 0.82rem;
        line-height: 1.3;
      }

      .hero-identity-name {
        margin: 0;
        color: var(--fg);
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .hero-thesis {
        align-self: center;
        width: 100%;
        max-width: 42rem;
        padding: 2rem 0 2rem;
      }

      .hero-thesis h1 {
        width: 100%;
        margin: 0;
        font-size: 1.2rem;
        font-weight: 500;
        line-height: 1.65;
        letter-spacing: 0;
        text-align: left;
        hyphens: none;
      }

      .hero-map {
        padding-top: 0;
      }

      .hero-map-label {
        margin: 0 0 1.1rem;
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.3;
      }

      .hero-map-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.25rem;
      }

      .hero-map-link {
        display: block;
        color: var(--fg);
        transition: color 0.2s ease;
      }

      .hero-map-link:hover { color: var(--muted); }

      .hero-map-link strong {
        font-size: 1.15rem;
        font-weight: 650;
        line-height: 1.2;
        letter-spacing: -0.02em;
      }

      @media (min-width: 1440px) {
        .hero-thesis h1 { font-size: 1.3rem; }
      }

      /* retained as a compact mobile fallback for the older masthead class */
      .masthead {
        flex: 0 0 auto;
        display: grid;
        grid-template-columns: 1.25fr 1fr;
        gap: clamp(2rem, 6vw, 5rem);
        align-items: center;
        padding: clamp(1.75rem, 3.5vw, 2.75rem) var(--pad) clamp(2.25rem, 4.5vw, 3.5rem);
      }

      .masthead h1 {
        margin: 0;
        font-size: clamp(2.5rem, 6.5vw, 4.5rem);
        font-weight: 600;
        line-height: 1;
        letter-spacing: -0.045em;
      }

      .masthead-bio {
        justify-self: end;
        max-width: 42ch;
      }

      .masthead .bio {
        margin: 0;
        font-size: clamp(0.875rem, 1.1vw, 0.95rem);
        line-height: 1.75;
        color: var(--muted);
      }

      .hero-essay {
        margin: 1rem 0 0;
        font-size: 0.85rem;
        line-height: 1.5;
      }
      .hero-essay a {
        color: var(--muted);
        text-decoration: none;
        border-bottom: 1px solid color-mix(in srgb, var(--muted) 35%, transparent);
        transition: color 0.15s ease, border-color 0.15s ease;
      }
      .hero-essay a:hover { color: var(--fg); border-color: var(--fg); }

      /* full-height sections */
      .section {
        min-height: 100vh;
        min-height: 100svh;
        display: flex;
        align-items: center;
        padding: clamp(3rem, 8vh, 7rem) 0;
        border-top: 1px solid var(--line);
      }
      .section > .wrap { width: 100%; }

      /* scroll-reveal: content rises in when its panel becomes active */
      @media (prefers-reduced-motion: no-preference) {
        .panel [data-reveal] {
          opacity: 0;
          transform: translateY(26px);
          transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
          transition-delay: calc(var(--i, 0) * 90ms);
          will-change: opacity, transform;
        }
        .panel.is-active [data-reveal] { opacity: 1; transform: none; }
      }

      /* nav fades in once the user moves off the hero
         (.topbar.topbar-home keeps it more specific than the later sticky .topbar rule
         so it stays fixed and out of flow instead of reserving space above the hero) */
      .topbar.topbar-home {
        position: fixed;
        top: 0; left: 0; right: 0;
        z-index: 55;
        opacity: 0;
        transform: translateY(-100%);
        transition: opacity 0.4s ease, transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
      }
      .topbar.topbar-home.show { opacity: 1; transform: none; pointer-events: auto; }

      @media (hover: none) {
        html { scroll-snap-type: y proximity; }
        .hero, .section { scroll-snap-align: start; }
      }

      @media (max-width: 760px) {
        html { scroll-snap-type: none; }

        .hero {
          height: auto;
          min-height: 100vh;
          min-height: 100svh;
          display: flex;
          overflow: visible;
        }
        .hero-inner {
          gap: 2.5rem;
          padding: 1.35rem var(--pad) 1.75rem;
        }
        .hero-identity {
          font-size: 0.8rem;
        }
        .hero-thesis {
          align-self: start;
          padding: 1.5rem 0 1.25rem;
        }
        .hero-thesis h1 {
          font-size: 1.1rem;
          line-height: 1.65;
        }
        .hero-map-grid {
          grid-template-columns: 1fr;
          gap: 1rem;
        }
        .hero-map-link {
          padding: 0;
        }
        .masthead {
          grid-template-columns: 1fr;
          gap: 1.15rem;
          align-items: start;
          padding: 1.6rem var(--pad) 2.7rem;
        }
        .masthead h1 {
          font-size: clamp(2.35rem, 11vw, 3.25rem);
        }
        .masthead-bio {
          justify-self: start;
          max-width: none;
        }
        .section {
          min-height: 0;
          display: block;
          padding: 2.85rem 0;
        }
        .section + .section {
          padding-top: 3rem;
        }
        #about {
          min-height: 100vh;
          min-height: 100svh;
          padding-top: 2.65rem;
        }
        #writing {
          padding-top: 3rem;
          padding-bottom: 2.7rem;
        }
        #work {
          padding-top: 3.15rem;
          padding-bottom: 3.25rem;
        }
        .panel [data-reveal] {
          opacity: 1;
          transform: none;
          transition: none;
        }
      }

      /* ---- bookshelf ---- */
      .shelves {
        position: relative;
        padding: clamp(1rem, 2vw, 1.5rem) 0 clamp(2.5rem, 5vw, 4rem);
      }
      /* each row is a recessed compartment: a back panel + a real plank with depth */
      .shelf-row {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0 1px;
        width: 100%;
        min-height: 248px;
        margin-top: clamp(3rem, 6vw, 4.5rem);
        padding: 26px 16px 0;
        border-radius: 3px 3px 0 0;
        /* back wall of the recess, with ambient occlusion up top and in the corners */
        background:
          radial-gradient(140% 70% at 50% 0%, rgba(0, 0, 0, 0.16), transparent 60%),
          linear-gradient(180deg, color-mix(in srgb, var(--shelf-back) 82%, #000) 0%, var(--shelf-back) 30%);
        box-shadow:
          inset 0 18px 26px -18px rgba(0, 0, 0, 0.5),
          inset 22px 0 30px -26px rgba(0, 0, 0, 0.45),
          inset -22px 0 30px -26px rgba(0, 0, 0, 0.45);
        perspective: 2600px;
        perspective-origin: 50% 36%;
      }
      .shelf-row:first-child { margin-top: 1.25rem; }
      /* the plank lip the books rest in */
      .shelf-row::before {
        content: "";
        position: absolute;
        left: -8px;
        right: -8px;
        bottom: 0;
        height: 6px;
        z-index: 3;
        border-radius: 1px;
        background: linear-gradient(180deg, color-mix(in srgb, var(--shelf-wood) 52%, #fff), var(--shelf-wood));
      }
      /* the visible front edge / thickness of the plank */
      .shelf-row::after {
        content: "";
        position: absolute;
        left: -8px;
        right: -8px;
        bottom: -16px;
        height: 16px;
        z-index: 2;
        border-radius: 0 0 3px 3px;
        background: linear-gradient(180deg, var(--shelf-wood) 0%, var(--shelf-wood-deep) 100%);
        box-shadow:
          0 18px 26px -12px var(--shelf-shadow),
          inset 0 1px 0 color-mix(in srgb, var(--shelf-wood) 72%, #fff);
      }

      .book {
        position: relative;
        flex: 0 0 var(--thick);
        width: var(--thick);
        height: var(--h);
        margin-bottom: 2px;
        padding: 0;
        border: 0;
        background: none;
        font-family: inherit;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transform-style: preserve-3d;
        transition: transform 0.6s cubic-bezier(0.34, 1.08, 0.42, 1);
      }
      /* contact shadow where the book meets the plank */
      .book::after {
        content: "";
        position: absolute;
        left: -2px;
        right: -2px;
        bottom: -3px;
        height: 9px;
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.42), transparent 72%);
        opacity: 0.6;
        z-index: -1;
        transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .book-3d {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
        transform-origin: 50% 100%;
        transform: rotate(var(--lean, 0deg));
        transition: transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .bk-face {
        position: absolute;
        top: 0;
        left: 0;
        overflow: hidden;
      }
      /* spine: the face you see on the shelf */
      .bk-spine {
        width: var(--thick);
        height: var(--h);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 1px 2px 2px 1px;
        color: var(--sc, #f4f1ea);
        /* cylindrical sheen across the spine reads as a rounded book back */
        background:
          linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.42) 0%,
            rgba(0, 0, 0, 0.12) 5%,
            rgba(255, 255, 255, 0.18) 15%,
            rgba(255, 255, 255, 0.04) 45%,
            rgba(0, 0, 0, 0.10) 80%,
            rgba(0, 0, 0, 0.5) 100%
          ),
          var(--c);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.22),
          inset 0 -2px 3px rgba(0, 0, 0, 0.34);
      }
      /* head + tail bands near the top/bottom of the spine */
      .bk-spine::before,
      .bk-spine::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        height: 1px;
        background: rgba(255, 255, 255, 0.16);
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.28);
      }
      .bk-spine::before { top: 10px; }
      .bk-spine::after { bottom: 10px; }
      .s-text {
        writing-mode: vertical-rl;
        text-orientation: mixed;
        display: flex;
        align-items: center;
        gap: 0.85em;
        max-height: 86%;
        min-height: 0;
        margin: 0 auto;
        white-space: nowrap;
        overflow: hidden;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.4);
      }
      /* title wins the space fight: it shrinks last and only truncates if it alone
         overruns the spine; the author collapses (and ellipsises) first. */
      .s-title {
        flex: 0 1 auto;
        min-height: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: var(--tfs, 11px);
        font-weight: 700;
        letter-spacing: 0.015em;
      }
      .s-author {
        flex: 0 100000 auto;
        min-height: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: var(--afs, 8px);
        font-weight: 500;
        color: color-mix(in srgb, var(--sc, #f4f1ea) 64%, transparent);
      }
      /* front cover: the large face, hinged back along the spine's right edge */
      .bk-cover {
        width: var(--w);
        height: var(--h);
        left: 0;
        transform-origin: left center;
        transform: translateX(var(--thick)) rotateY(90deg);
        background: var(--c);
        background-size: cover;
        background-position: center;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 0.85rem 0.75rem;
        border-radius: 0 2px 2px 0;
        box-shadow:
          inset 3px 0 8px rgba(0, 0, 0, 0.32),
          inset 0 0 26px rgba(0, 0, 0, 0.16);
      }
      .bk-cover .c-rule {
        width: 20px;
        height: 2px;
        background: rgba(246,243,236,0.55);
        margin-bottom: 0.5rem;
      }
      .bk-cover .c-title {
        font-size: 0.8rem;
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: -0.01em;
        color: #f6f3ec;
      }
      .bk-cover .c-author {
        font-size: 0.62rem;
        color: rgba(246,243,236,0.72);
      }
      .bk-cover.has-img { padding: 0; }
      .bk-cover.has-img .c-top,
      .bk-cover.has-img .c-author { display: none; }
      /* back cover: parallel large face on the far side */
      .bk-back {
        width: var(--w);
        height: var(--h);
        left: 0;
        transform-origin: left center;
        transform: rotateY(90deg);
        background: linear-gradient(90deg, color-mix(in srgb, var(--c) 62%, #000), var(--c));
        border-radius: 2px 0 0 2px;
      }
      /* fore-edge: the cut pages opposite the spine, at the back of the book */
      .bk-fore {
        width: var(--thick);
        height: var(--h);
        left: 0;
        transform: translateZ(calc(-1 * var(--w)));
        background:
          repeating-linear-gradient(90deg, #e9e0c9 0 1px, #d8ccae 1px 2px),
          linear-gradient(180deg, #efe7d2, #ddd0b4);
      }
      /* page block: top edge of the pages */
      .bk-top {
        width: var(--thick);
        height: var(--w);
        top: 0;
        left: 0;
        transform-origin: top center;
        transform: rotateX(-90deg);
        background:
          repeating-linear-gradient(90deg, #ece4d0 0 1px, #dacfb2 1px 2px),
          linear-gradient(180deg, #f5efdd, #e6dcc4);
        box-shadow: inset 0 0 10px rgba(120, 96, 54, 0.22);
      }
      .bk-bottom {
        width: var(--thick);
        height: var(--w);
        top: 0;
        left: 0;
        transform-origin: top center;
        transform: translateY(var(--h)) rotateX(-90deg);
        background: linear-gradient(180deg, #d8cdb0, #c7bb9c);
      }

      .book:hover,
      .book:focus-visible,
      .book.is-presenting {
        z-index: 6;
        outline: none;
      }

      /* stage 1: hover nudge, tip the book out at the top like hooking a finger over it */
      .book:hover:not(.is-presenting) .book-3d {
        transform: rotate(var(--lean, 0deg)) translateY(-7px) translateZ(16px) rotateX(9deg);
      }
      .book:hover:not(.is-presenting)::after {
        opacity: 0.45;
        transform: translateY(6px) scaleX(1.05);
      }

      /* neighbours lean into the gap left by the pulled book */
      .book.lean-r .book-3d { transform: rotate(calc(var(--lean, 0deg) + 5deg)); }
      .book.lean-l .book-3d { transform: rotate(calc(var(--lean, 0deg) - 5deg)); }

      /* stage 2: present, pull straight out toward the viewer, then hold it at a 3/4 angle.
         the lift lives on .book (slow, weighted); the turn lives on .book-3d. */
      .book.is-presenting {
        z-index: 60;
        transform: translateZ(200px) translateY(-22px) translateX(var(--present-x, -40px));
      }
      .book.is-presenting .book-3d {
        transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        transform: rotateY(-58deg) rotateX(7deg);
      }
      .book.is-presenting::after {
        opacity: 0.3;
        transform: translateY(96px) scale(1.7);
      }

      @media (prefers-reduced-motion: reduce) {
        .book, .book-3d, .book::after { transition: none; }
        .book:hover:not(.is-presenting) .book-3d { transform: rotate(var(--lean, 0deg)) translateY(-5px); }
      }

      @media (max-width: 760px) {
        .shelf-row { min-height: 208px; padding-top: 20px; }
        .book.is-presenting { transform: translateZ(140px) translateY(-16px) translateX(var(--present-x, -34px)); }
      }

      .sec-title {
        margin: 0 0 clamp(1.75rem, 3.5vw, 2.5rem);
        font-size: clamp(2rem, 5vw, 3rem);
        font-weight: 700;
        letter-spacing: -0.04em;
        line-height: 1;
      }

      .sec-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1.5rem;
        margin-bottom: clamp(1.75rem, 3.5vw, 2.5rem);
      }
      .sec-head .sec-title { margin: 0; }
      a.sec-title-link {
        color: inherit;
        transition: opacity 0.18s ease;
      }
      a.sec-title-link:hover { opacity: 0.55; }

      .see-all {
        font-size: 0.85rem;
        color: var(--muted);
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        transition: color 0.18s ease;
      }
      .see-all:hover { color: var(--fg); }
      .see-all .arr { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
      .see-all:hover .arr { transform: translateX(4px); }

      /* about */
      .about-grid {
        display: grid;
        grid-template-columns: 1.4fr 0.85fr;
        gap: clamp(2rem, 6vw, 4.5rem);
        align-items: start;
      }
      .about-body p { margin: 0 0 1rem; font-size: 1rem; line-height: 1.8; }
      .about-body p:last-of-type { margin-bottom: 0; }
      .about-body a { text-decoration: underline; text-underline-offset: 0.18em; text-decoration-color: var(--line); }
      .about-body a:hover { text-decoration-color: currentColor; }

      .contact {
        margin-top: 1.75rem;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.65rem 1rem;
        font-size: 0.9rem;
      }
      .contact a { color: var(--fg); position: relative; }
      .contact a::after {
        content: "";
        position: absolute;
        left: 0; bottom: -2px;
        width: 100%; height: 1px;
        background: currentColor;
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .contact a:hover::after { transform: scaleX(1); }
      .contact .dot { color: var(--faint); }

      /* highlights timeline */
      .highlights-block { margin-top: clamp(2.5rem, 5vw, 3.5rem); }
      .highlights-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.25rem;
      }
      .highlights-title {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--faint);
      }
      .tl-hint {
        font-size: 0.65rem;
        color: var(--muted);
        line-height: 1;
      }
      .tl-wrap {
        position: relative;
        padding-bottom: 0.5rem;
      }
      .tl-wrap::before {
        content: "";
        position: absolute;
        left: 78px;
        top: 0;
        bottom: 0;
        width: 1px;
        background: linear-gradient(to bottom, transparent, var(--line) 6%, var(--line) 94%, transparent);
        pointer-events: none;
        transform-origin: top center;
        transform: scaleY(0);
        transition: transform 1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
        z-index: 0;
      }
      .tl-wrap.tl-active::before { transform: scaleY(1); }
      .tl-entry {
        display: flex;
        align-items: center;
        margin-bottom: 1.75rem;
        opacity: 0;
        transform: translateX(-10px);
        transition: opacity 0.48s cubic-bezier(0.16, 1, 0.3, 1) calc(var(--i) * 0.13s),
                    transform 0.48s cubic-bezier(0.16, 1, 0.3, 1) calc(var(--i) * 0.13s);
        position: relative;
        z-index: 1;
      }
      .tl-entry:last-child { margin-bottom: 0; }
      .tl-entry.tl-visible { opacity: 1; transform: none; }
      .tl-img {
        width: 64px;
        height: 64px;
        flex: 0 0 64px;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--line);
      }
      .tl-img img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .tl-img:hover img { transform: scale(1.07); }
      .tl-connector {
        width: 28px;
        flex: 0 0 28px;
        display: flex;
        justify-content: center;
        align-items: center;
        align-self: stretch;
      }
      .tl-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--fg);
        flex-shrink: 0;
        transition: transform 0.2s ease;
        position: relative;
        z-index: 2;
      }
      .tl-entry:hover .tl-dot { transform: scale(1.55); }
      .tl-body { flex: 1; padding-left: 0.85rem; }
      .tl-date { font-size: 0.72rem; color: var(--muted); margin-bottom: 0.18rem; }
      .tl-text { font-size: 0.9rem; line-height: 1.5; }
      .tl-note {
        font-size: 0.72rem;
        color: var(--muted);
        line-height: 1.6;
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        margin-top: 0;
        transform: translateY(-5px);
        transition: max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                    margin-top 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                    opacity 0.35s ease 0.1s,
                    transform 0.4s ease 0.1s;
      }
      .tl-entry:hover .tl-note,
      .tl-entry.tl-tapped .tl-note {
        max-height: 50vh;
        opacity: 1;
        margin-top: 0.45rem;
        transform: translateY(0);
      }
      @media (max-width: 480px) {
        .tl-wrap::before { left: 58px; }
        .tl-img { width: 48px; height: 48px; flex: 0 0 48px; }
        .tl-connector { width: 20px; flex: 0 0 20px; }
        .tl-text { font-size: 0.82rem; }
      }

      .portrait {
        width: 100%;
        max-width: 320px;
        height: auto;
        margin-left: auto;
        display: block;
        aspect-ratio: 3 / 4;
        object-fit: contain;
        object-position: top center;
        filter: var(--portrait-filter);
        mix-blend-mode: var(--portrait-blend);
      }

      /* in dark mode the black-ink portrait sits on a soft light card so it reads naturally */
      [data-theme="dark"] .portrait {
        background: #f4f4f2;
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 0.5rem 0.5rem 0;
      }

      /* entry lists (writing / work) */
      .entries { display: flex; flex-direction: column; }
      .entry {
        display: block;
        padding: clamp(1rem, 2vw, 1.4rem) 0;
        border-top: 1px solid var(--line);
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .entry:first-child { border-top: 0; padding-top: 0; }
      .entry:hover { transform: translateX(6px); }
      .entry-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1.5rem;
      }
      .entry-title {
        margin: 0;
        font-size: clamp(1.1rem, 2vw, 1.35rem);
        font-weight: 500;
        letter-spacing: -0.015em;
        line-height: 1.25;
      }
      .entry-sub { margin: 0.35rem 0 0; color: var(--muted); font-size: 0.95rem; }
      .entry-meta { color: var(--faint); font-size: 0.8rem; white-space: nowrap; flex-shrink: 0; }

      /* work cards (home) */
      .work-cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: clamp(1.1rem, 2.5vw, 2rem);
      }
      .card { display: block; }
      .card-media-wrap {
        display: block;
        aspect-ratio: 4 / 3;
        overflow: hidden;
        border-radius: 10px;
        border: 1px solid var(--line);
      }
      .card-media {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        background-size: cover;
        background-position: center;
        transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .card:hover .card-media { transform: scale(1.05); }
      .card-title {
        display: block;
        margin: 1rem 0 0;
        font-size: 1.15rem;
        font-weight: 500;
        letter-spacing: -0.015em;
      }
      .card:hover .card-title { text-decoration: underline; text-underline-offset: 0.18em; }
      .card-desc {
        display: block;
        margin: 0.35rem 0 0;
        color: var(--muted);
        font-size: 0.9rem;
        line-height: 1.55;
      }
      .card-meta {
        display: block;
        margin: 0.45rem 0 0;
        font-size: 0.75rem;
        color: var(--faint);
      }
      #work .work-cards {
        grid-template-columns: repeat(2, 1fr);
        gap: clamp(1.25rem, 3vw, 2.75rem);
      }
      #work .card-media-wrap {
        aspect-ratio: 1 / 1;
        width: 100%;
        border-radius: 12px;
      }
      #work .card-title {
        font-size: clamp(1.2rem, 2.2vw, 1.5rem);
        margin-top: 1.15rem;
      }
      #work .card-desc {
        font-size: clamp(0.92rem, 1.15vw, 1rem);
        line-height: 1.5;
      }
      .page-work .work-cards,
      .page-writing .writing-grid {
        padding-bottom: clamp(3rem, 6vw, 4.5rem);
      }
      .work-tier { margin-bottom: clamp(2rem, 4vw, 3rem); }
      .work-tier:last-child { margin-bottom: 0; }
      .work-tier-more {
        padding-top: clamp(1.75rem, 3.5vw, 2.5rem);
        border-top: 1px solid var(--line);
      }
      .work-tier-label {
        margin: 0 0 0.65rem;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--fg);
      }
      .work-tier-note {
        margin: 0 0 clamp(1.4rem, 3vw, 2rem);
        color: var(--muted);
        font-size: 0.82rem;
        line-height: 1.65;
      }
      .work-tier-main .card-media-wrap { aspect-ratio: 21 / 9; }
      .work-tier-more .work-cards { margin-top: 0; }
      .work-text-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: clamp(1.25rem, 3vw, 2.75rem);
      }
      .work-text-item {
        position: relative;
        display: block;
        padding: 1rem 0 1.05rem;
        border-bottom: 1px solid var(--line);
        transition: padding-left 0.22s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .work-text-item::after {
        content: "→";
        position: absolute;
        top: 1.04rem;
        right: 0;
        color: var(--faint);
        opacity: 0;
        transform: translateX(-0.35rem);
        transition:
          opacity 0.22s ease,
          transform 0.22s cubic-bezier(0.4, 0, 0.2, 1),
          color 0.18s ease;
      }
      .work-text-title {
        display: block;
        padding-right: 1.6rem;
        font-size: clamp(1.05rem, 1.8vw, 1.22rem);
        font-weight: 500;
      }
      .work-text-desc {
        display: block;
        padding-right: 1.6rem;
        margin-top: 0.28rem;
        color: var(--muted);
        font-size: 0.92rem;
        line-height: 1.45;
      }
      .work-text-item:hover {
        padding-left: 0.35rem;
      }
      .work-text-item:hover .work-text-title {
        text-decoration: underline;
        text-underline-offset: 0.18em;
      }
      .work-text-item:hover::after {
        opacity: 1;
        transform: translateX(0);
        color: var(--fg);
      }

      /* about page sections */
      .about-section {
        margin-top: clamp(3rem, 6vw, 4.5rem);
        padding-top: clamp(2rem, 4vw, 3rem);
        border-top: 1px solid var(--line);
      }
      .about-section:first-of-type {
        margin-top: clamp(1.5rem, 3vw, 2rem);
        padding-top: 0;
        border-top: 0;
      }
      .about-section .section-label {
        margin: 0 0 clamp(1.25rem, 2.5vw, 1.75rem);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--faint);
      }
      .about-section .prose { max-width: 680px; }
      .highlights-block { margin-top: 0; }
      .section-toggle {
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;
        font: inherit;
        margin: 0;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--faint);
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        transition: color 0.18s ease;
      }
      .section-toggle:hover { color: var(--fg); }
      .section-toggle .caret {
        transition: transform 0.2s ease;
        display: inline-block;
        font-size: 1rem;
        line-height: 1;
      }
      .section-toggle[aria-expanded="true"] .caret { transform: rotate(90deg); }
      .section-panel[hidden] { display: none; }
      .section-panel { margin-top: 1.25rem; }

      .writing-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: clamp(1.25rem, 2.5vw, 2rem);
      }
      @media (max-width: 760px) {
        .work-cards { grid-template-columns: 1fr; gap: 1.75rem; }
        .work-text-list { grid-template-columns: 1fr; }
        .card-media-wrap { max-width: none; }
        .page-writing .writing-grid {
          grid-template-columns: 1fr;
          gap: 2.25rem;
        }
        .page-writing .writing-tier-main {
          margin-bottom: 2.25rem;
        }
        #work .work-cards {
          grid-template-columns: 1fr;
          gap: 2.25rem;
        }
        #work .card-media-wrap {
          aspect-ratio: 1 / 1;
          border-radius: 12px;
        }
      }

      /* writing (home): single hero with detail column */
      #writing {
        padding: clamp(2rem, 5vh, 3.5rem) 0;
      }
      #writing .sec-head {
        margin-bottom: clamp(1.15rem, 2.4vw, 1.75rem);
      }
      #writing .writing-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
        gap: clamp(1.35rem, 3vw, 2.8rem);
        align-items: center;
      }
      #writing .writing-hero {
        display: block;
      }
      #writing .writing-hero .card-media-wrap {
        aspect-ratio: 16 / 11;
        width: 100%;
        border-radius: 14px;
        max-height: clamp(14rem, 42vh, 28rem);
      }
      #writing .writing-hero .card-title,
      #writing .writing-hero .card-desc {
        display: none;
      }
      #writing .writing-detail {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.65rem;
      }
      #writing .writing-kicker {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--faint);
      }
      #writing .writing-detail-title {
        margin: 0;
        font-size: clamp(1.28rem, 2.35vw, 1.9rem);
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.18;
      }
      #writing .writing-detail-title a { color: inherit; }
      #writing .writing-detail-title a:hover {
        text-decoration: underline;
        text-underline-offset: 0.17em;
      }
      #writing .writing-detail-meta {
        margin: 0;
        font-size: 0.78rem;
        color: var(--faint);
      }
      #writing .writing-detail-desc {
        margin: 0.2rem 0 0;
        font-size: clamp(0.9rem, 1.08vw, 0.98rem);
        line-height: 1.52;
        color: var(--muted);
        max-width: 34ch;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      @media (max-width: 760px) {
        #writing {
          padding: 3rem 0 2.7rem;
        }
        #writing .sec-head {
          align-items: end;
          margin-bottom: 1.45rem;
        }
        #writing .sec-title {
          font-size: clamp(2.45rem, 12vw, 3.55rem);
        }
        #writing .see-all {
          padding-bottom: 0.3rem;
          color: var(--muted);
        }
        #writing .writing-layout {
          grid-template-columns: 1fr;
          gap: 1.55rem;
        }
        #writing .writing-hero .card-media-wrap {
          aspect-ratio: 16 / 10.6;
          border-radius: 13px;
        }
        #writing .writing-detail {
          justify-content: flex-start;
          gap: 0.78rem;
          padding-bottom: 0.35rem;
        }
        #writing .writing-kicker {
          color: var(--faint);
          font-size: 0.68rem;
          letter-spacing: 0.2em;
        }
        #writing .writing-detail-title {
          font-size: clamp(1.55rem, 7vw, 2.05rem);
          line-height: 1.08;
          max-width: 12ch;
        }
        #writing .writing-detail-meta {
          display: none;
        }
        #writing .writing-detail-desc {
          max-width: 30ch;
          font-size: 0.94rem;
          line-height: 1.65;
        }
      }
      #writing .writing-more {
        margin-top: clamp(0.85rem, 2vw, 1.35rem);
        padding-top: 0;
        border-top: 1px solid var(--line);
      }
      #writing .writing-more-grid {
        display: flex;
        flex-direction: column;
      }
      #writing .writing-more .entry {
        display: grid;
        grid-template-columns: 2.75rem minmax(0, 1fr) auto;
        gap: clamp(0.75rem, 2vw, 1.5rem);
        align-items: center;
        min-height: 5.4rem;
        padding: clamp(0.85rem, 1.8vw, 1.15rem) 0;
        border-top: 0;
        border-bottom: 1px solid var(--line);
        transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #writing .writing-more .entry:hover {
        transform: translateX(6px);
      }
      #writing .writing-more .entry-index {
        color: var(--faint);
        font-size: 0.72rem;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.12em;
      }
      #writing .writing-more .entry-copy {
        min-width: 0;
      }
      #writing .writing-more .entry-title {
        display: block;
        margin: 0;
        font-size: clamp(0.95rem, 1.35vw, 1.12rem);
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.2;
        color: var(--fg);
      }
      #writing .writing-more .entry-desc {
        display: -webkit-box;
        margin: 0.25rem 0 0;
        color: var(--muted);
        font-size: clamp(0.76rem, 0.9vw, 0.84rem);
        font-weight: 400;
        line-height: 1.35;
        max-width: 42ch;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      #writing .writing-more .entry-meta {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        color: var(--faint);
        font-size: 0.72rem;
        font-weight: 400;
        white-space: nowrap;
      }
      #writing .writing-more .entry-arrow {
        color: var(--muted);
        font-size: 1rem;
        line-height: 1;
        transition: color 0.18s ease, transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #writing .writing-more .entry:hover .entry-arrow {
        color: var(--fg);
        transform: translateX(4px);
      }
      @media (max-width: 760px) {
        #writing .writing-more {
          margin-top: 0.75rem;
          border-top-color: color-mix(in srgb, var(--line) 72%, transparent);
        }
        #writing .writing-more .entry {
          grid-template-columns: 2.75rem minmax(0, 1fr);
          min-height: 0;
          padding: 1.02rem 0;
          align-items: center;
          gap: 0.9rem;
          border-bottom-color: color-mix(in srgb, var(--line) 72%, transparent);
        }
        #writing .writing-more .entry-index {
          font-size: 0.76rem;
          align-self: start;
          padding-top: 0.18rem;
        }
        #writing .writing-more .entry-title {
          font-size: clamp(1.02rem, 4.5vw, 1.22rem);
          line-height: 1.18;
        }
        #writing .writing-more .entry-desc {
          margin-top: 0.42rem;
          font-size: 0.86rem;
          line-height: 1.48;
          -webkit-line-clamp: 2;
        }
        #writing .writing-more .entry-meta {
          display: none;
        }
      }
      .writing-tier { margin-bottom: clamp(2rem, 4vw, 3rem); }
      .writing-tier:last-child { margin-bottom: 0; }
      .writing-tier-main .card-media-wrap { aspect-ratio: 21 / 9; }
      @media (max-width: 760px) {
        .page-writing .writing-tier-main .card-media-wrap {
          aspect-ratio: 1 / 1;
        }
      }

      /* featured (latest) entry */
      .featured {
        display: block;
        padding-bottom: clamp(1.5rem, 3vw, 2.25rem);
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .featured:hover { transform: translateX(6px); }
      .f-row { display: flex; align-items: baseline; justify-content: space-between; gap: 1.5rem; }
      .f-title {
        margin: 0;
        font-size: clamp(1.6rem, 3vw, 2.3rem);
        font-weight: 600;
        letter-spacing: -0.03em;
        line-height: 1.08;
      }
      .f-meta { color: var(--faint); font-size: 0.85rem; white-space: nowrap; flex-shrink: 0; }
      .f-excerpt {
        margin: 1rem 0 0;
        color: var(--muted);
        font-size: 1.05rem;
        line-height: 1.7;
        max-width: 58ch;
      }

      .eyebrow {
        margin: 0 0 1.5rem;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--faint);
      }
      .reading-block { max-width: 34rem; }
      .reading-title {
        margin: 0;
        font-size: clamp(1.6rem, 3.5vw, 2.5rem);
        font-weight: 700;
        letter-spacing: -0.035em;
        line-height: 1.08;
      }
      .reading-author { margin: 0.85rem 0 0; color: var(--muted); font-size: 1.05rem; }
      .reading-note { margin: 1.6rem 0 0; color: var(--muted); max-width: 46ch; line-height: 1.85; }

      /* subpage header */
      .topbar {
        position: sticky;
        top: 0;
        z-index: 50;
        background: var(--topbar-bg);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border-bottom: 1px solid var(--line);
      }
      .topbar-inner {
        max-width: var(--max);
        margin: 0 auto;
        padding: 0.9rem var(--pad);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .topbar .mark { font-weight: 700; letter-spacing: -0.02em; order: 1; }
      .topbar nav {
        order: 2;
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 1.25rem;
        font-size: 0.85rem;
      }
      .topbar nav a { color: var(--muted); }
      .topbar nav a:hover, .topbar nav a.active { color: var(--fg); }

      .topbar-actions {
        order: 3;
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }

      .menu-toggle {
        display: none;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 4px;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: transparent;
        color: var(--fg);
        cursor: pointer;
      }
      .menu-line {
        width: 17px;
        height: 1.5px;
        border-radius: 999px;
        background: currentColor;
        display: block;
        transition:
          transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
          opacity 0.18s ease;
      }

      .theme-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: transparent;
        color: var(--fg);
        cursor: pointer;
        transition: border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
      }
      .theme-toggle:hover { border-color: var(--fg); transform: rotate(12deg); }
      .theme-toggle svg { width: 16px; height: 16px; display: block; }
      .theme-toggle .icon-sun { display: none; }
      [data-theme="dark"] .theme-toggle .icon-moon { display: none; }
      [data-theme="dark"] .theme-toggle .icon-sun { display: block; }

      @media (max-width: 760px) {
        .topbar.topbar-home {
          opacity: 0;
          transform: translateY(-100%);
          pointer-events: none;
        }
        .topbar.topbar-home.show {
          opacity: 1;
          transform: none;
          pointer-events: auto;
        }
        .topbar-inner {
          min-height: 64px;
          padding: 0.72rem var(--pad);
          position: relative;
          z-index: 56;
        }
        .topbar.is-menu-open .topbar-inner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 10000;
          max-width: none;
          background: var(--bg);
          border-bottom: 1px solid var(--line);
        }
        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 0.55rem;
        }
        .topbar .mark {
          white-space: nowrap;
        }
        .menu-toggle {
          display: inline-flex;
        }
        .topbar > .topbar-inner > .topbar-actions > .theme-toggle {
          width: 40px;
          height: 40px;
        }
        .topbar nav {
          position: fixed;
          top: 64px;
          right: 0;
          bottom: auto;
          left: 0;
          z-index: 9000;
          width: 100vw;
          height: 100vh;
          height: 100svh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(1.45rem, 4.5svh, 2.35rem);
          padding: 3rem var(--pad) 5rem;
          background: var(--bg);
          opacity: 0;
          transform: translateY(0.9rem);
          pointer-events: none;
          transition:
            opacity 0.34s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .topbar.is-menu-open nav {
          opacity: 1;
          transform: none;
          pointer-events: auto;
        }
        .topbar nav a {
          display: block;
          padding: 0.2rem 0;
          color: var(--fg);
          font-size: clamp(2rem, 9vw, 3.25rem);
          font-weight: 650;
          letter-spacing: -0.045em;
          line-height: 0.95;
          transform: translateY(0.7rem);
          opacity: 0;
          transition:
            opacity 0.34s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.44s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .topbar.is-menu-open .menu-line:nth-child(1) {
          transform: translateY(5.5px) rotate(45deg);
        }
        .topbar.is-menu-open .menu-line:nth-child(2) {
          opacity: 0;
        }
        .topbar.is-menu-open .menu-line:nth-child(3) {
          transform: translateY(-5.5px) rotate(-45deg);
        }
        .topbar.is-menu-open nav a {
          opacity: 1;
          transform: none;
        }
        .topbar.is-menu-open nav a:nth-child(1) { transition-delay: 0.05s; }
        .topbar.is-menu-open nav a:nth-child(2) { transition-delay: 0.1s; }
        .topbar.is-menu-open nav a:nth-child(3) { transition-delay: 0.15s; }
        .topbar.is-menu-open nav a:nth-child(4) { transition-delay: 0.2s; }
        body.menu-open {
          overflow: hidden;
        }
      }

      /* article / reading column */
      .project-banner-line {
        display: block;
        width: 100%;
        height: 7.5px;
        padding: 0;
        min-height: 0;
        flex-shrink: 0;
      }
      .project-banner {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #2563eb;
        padding: 0.85rem var(--pad);
      }
      .project-banner img {
        display: block;
        width: auto;
        height: auto;
        max-height: 4.5rem;
        max-width: min(100%, 18rem);
      }
      .project-banner-line + .wrap .article-head,
      .project-banner + .wrap .article-head {
        padding-top: clamp(1.5rem, 3vw, 2.25rem);
      }
      .article-head { padding: clamp(2.5rem, 5vw, 3.75rem) 0 clamp(1.75rem, 3vw, 2.25rem); }
      .article-head h1 {
        margin: 0;
        font-size: clamp(1.9rem, 4.5vw, 2.85rem);
        font-weight: 700;
        letter-spacing: -0.04em;
        line-height: 1.05;
      }
      .article-head .lead { margin: 1rem 0 0; color: var(--muted); font-size: 1.05rem; max-width: 60ch; }
      .article-head .meta { margin: 1rem 0 0; color: var(--faint); font-size: 0.85rem; }
      .article-links { margin: 1.25rem 0 0; display: flex; gap: 1.25rem; font-size: 0.9rem; }
      .article-links a { text-decoration: underline; text-underline-offset: 0.18em; text-decoration-color: var(--line); }
      .article-links a:hover { text-decoration-color: currentColor; }

      .prose { max-width: 680px; padding-bottom: clamp(3rem, 6vw, 4.5rem); font-size: 1.02rem; line-height: 1.85; }
      .prose > *:first-child { margin-top: 0; }
      .prose p { margin: 1.15rem 0 0; }
      .prose h2 { margin: 2.5rem 0 0; font-size: 1.4rem; font-weight: 700; letter-spacing: -0.025em; }
      .prose h3 { margin: 1.75rem 0 0; font-size: 1.1rem; font-weight: 600; }
      .prose ul, .prose ol { margin: 1.15rem 0 0; padding-left: 1.3rem; }
      .prose li + li { margin-top: 0.4rem; }
      .prose a { text-decoration: underline; text-underline-offset: 0.18em; text-decoration-color: var(--line); }
      .prose a:hover { text-decoration-color: currentColor; }
      .prose blockquote { margin: 1.5rem 0 0; padding-left: 1.1rem; border-left: 2px solid var(--line); color: var(--muted); }
      .prose blockquote p { margin: 0.4rem 0 0; }
      .prose blockquote p:first-child { margin-top: 0; }
      .md-image { display: block; max-width: 100%; height: auto; margin-top: 1.25rem; border-radius: 4px; }

      .mockup-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
        margin-top: 1.25rem;
      }
      .mockup-grid .md-image { margin-top: 0; width: 100%; }
      @media (max-width: 560px) {
        .mockup-grid { grid-template-columns: 1fr; }
      }
      .video-embed {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        margin-top: 1.25rem;
        border-radius: 4px;
        overflow: hidden;
        background: #000;
      }
      .video-embed iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
      }
      .video-embed-link {
        margin: 0.65rem 0 0;
        font-size: 0.85rem;
        color: var(--muted);
      }
      .video-embed-link a {
        text-decoration: underline;
        text-underline-offset: 0.18em;
        text-decoration-color: var(--line);
      }
      .video-embed-link a:hover { text-decoration-color: currentColor; }
      p:has(> .md-image + .md-image) { display: flex; gap: 0.9rem; margin-top: 1.25rem; }
      p:has(> .md-image + .md-image) .md-image { flex: 1; min-width: 0; margin-top: 0; }
      .md-hr { border: 0; border-top: 1px solid var(--line); margin: 2rem 0; }
      .md-table-wrap { overflow-x: auto; margin-top: 1.25rem; }
      .md-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
      .md-table th, .md-table td { padding: 0.5rem 0.75rem; border: 1px solid var(--line); text-align: left; }
      .md-table th { color: var(--muted); font-weight: 600; }

      .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.5rem; }
      .chip {
        font-size: 0.78rem;
        padding: 0.25rem 0.6rem;
        border: 1px solid var(--line);
        border-radius: 999px;
        color: var(--muted);
      }
      .badge { font-size: 0.78rem; color: var(--muted); }

      .depth { margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid var(--line); }
      .depth-toggle {
        padding: 0; border: 0; background: none; cursor: pointer;
        font: inherit; font-size: 0.9rem; color: var(--muted);
        display: inline-flex; align-items: center; gap: 0.4rem;
      }
      .depth-toggle:hover { color: var(--fg); }
      .depth-toggle .caret { transition: transform 0.2s ease; display: inline-block; }
      .depth-toggle[aria-expanded="true"] .caret { transform: rotate(90deg); }
      .depth-panel[hidden] { display: none; }
      .depth-panel { margin-top: 1.5rem; }

      /* notes / log */
      .log-day { padding: clamp(1.25rem, 2.5vw, 1.75rem) 0; border-top: 1px solid var(--line); }
      .log-day:first-child { border-top: 0; padding-top: 0; }
      .log-date { font-size: 0.82rem; font-weight: 600; color: var(--muted); margin-bottom: 0.9rem; }
      .log-entry + .log-entry { margin-top: 1.1rem; }
      .log-time { font-size: 0.78rem; color: var(--faint); margin-bottom: 0.2rem; font-variant-numeric: tabular-nums; }
      .log-entry p { margin: 0; }
      .log-entry p + p { margin-top: 0.5rem; }

      /* footer */
      .footer {
        border-top: 1px solid var(--line);
        margin-top: clamp(2rem, 5vw, 4rem);
      }
      .footer-inner {
        max-width: var(--max);
        margin: 0 auto;
        padding: 2rem var(--pad) 2.75rem;
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 1rem;
        font-size: 0.85rem;
        color: var(--muted);
      }
      .footer-inner .links { display: flex; gap: 1.25rem; }
      .footer-inner a:hover { color: var(--fg); }

      @media (max-width: 760px) {
        .masthead { grid-template-columns: 1fr; gap: 1.5rem; align-items: start; }
        .masthead-bio { justify-self: start; max-width: none; }
        .about-grid { grid-template-columns: 1fr; gap: 1.35rem; }
        .about-grid > .portrait {
          display: none;
        }
        .about-grid > div { order: 1; }
        .contact { margin-top: 1.35rem; }
        .topbar nav { gap: 1rem; }
      }
${lightboxStyles}
  `;
}

function timelineScript() {
  return `
    <script>
      (function () {
        var wrap = document.querySelector('.tl-wrap');
        if (!wrap) return;
        var entries = document.querySelectorAll('.tl-entry');
        var hint = document.querySelector('.tl-hint');
        var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (hint && isTouch) hint.textContent = 'tap logo for notes';

        var lineObserver = new IntersectionObserver(function (observed) {
          observed.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('tl-active');
              lineObserver.unobserve(entry.target);
            }
          });
        }, { threshold: 0.05 });
        lineObserver.observe(wrap);

        var entryObserver = new IntersectionObserver(function (observed) {
          observed.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('tl-visible');
              entryObserver.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15 });
        entries.forEach(function (el) { entryObserver.observe(el); });

        if (isTouch) {
          document.querySelectorAll('.tl-img').forEach(function (img) {
            img.addEventListener('click', function () {
              var row = img.closest('.tl-entry');
              if (!row) return;
              var open = row.classList.contains('tl-tapped');
              entries.forEach(function (e) { e.classList.remove('tl-tapped'); });
              if (!open) row.classList.add('tl-tapped');
            });
          });
        }
      })();
    </script>`;
}

function relRoot(depth) {
  return depth === 1 ? "" : "../";
}

function renderHighlights(items, escapeHtml, { imgPrefix = "", expanded = false, imgResolver = (s) => s } = {}) {
  const rows = items
    .map((item, i) => {
      const note = item.note
        ? `<div class="tl-note${expanded ? " is-open" : ""}">${escapeHtml(normalCapitalization(item.note))}</div>`
        : "";
      const imgSrc = item.image
        ? imgResolver
          ? imgResolver(item.image.replace(/^\.?\//, ""))
          : `${imgPrefix}${item.image.replace(/^\.?\//, "")}`
        : "";
      return `
        <div class="tl-entry" style="--i:${i}">
          <div class="tl-img"><img src="${imgSrc}" alt="" loading="lazy" decoding="async" width="64" height="64" /></div>
          <div class="tl-connector"><div class="tl-dot"></div></div>
          <div class="tl-body">
            <div class="tl-date">${escapeHtml(item.date)}</div>
            <div class="tl-text">${escapeHtml(normalCapitalization(item.title))}</div>
            ${note}
          </div>
        </div>`;
    })
    .join("");
  const hint = expanded ? "" : `<span class="tl-hint">Hover Logo for Notes</span>`;
  return `
          <div class="highlights-block">
            <div class="highlights-head">
              <h3 class="highlights-title">Highlights</h3>
              ${hint}
            </div>
            <div class="tl-wrap">${rows}</div>
          </div>`;
}

function aboutToggleScript() {
  return `
    <script>
      document.querySelectorAll('.section-toggle').forEach(function (btn) {
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        if (!panel) return;
        btn.addEventListener('click', function () {
          var open = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', open ? 'false' : 'true');
          panel.hidden = open;
        });
      });
    </script>`;
}

function depthScript() {
  return `
    <script>
      document.querySelectorAll('.depth-toggle').forEach(function (btn) {
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        if (!panel) return;
        btn.addEventListener('click', function () {
          var open = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', open ? 'false' : 'true');
          panel.hidden = open;
          btn.querySelector('.label').textContent = open ? 'technical details' : 'hide technical details';
        });
      });
    </script>`;
}

function deckScript() {
  return `
    <script>
      (function () {
        var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
        if (!panels.length) return;
        var topbar = document.querySelector('.topbar-home');
        var returnPanelKey = 'vedant-home-return-panel';

        function panelIndexFromId(id) {
          if (!id) return -1;
          var el = document.getElementById(id);
          return panels.indexOf(el);
        }

        function takeReturnPanelIndex() {
          var id = '';
          if (window.location.hash) id = window.location.hash.slice(1);
          if (!id) {
            try {
              id = sessionStorage.getItem(returnPanelKey) || '';
              sessionStorage.removeItem(returnPanelKey);
            } catch (e) {}
          }
          return panelIndexFromId(id);
        }

        document.addEventListener('click', function (e) {
          var link = e.target.closest && e.target.closest('a[href]');
          if (!link) return;
          var panel = link.closest('.panel');
          if (!panel || !panel.id || panel.id === 'hero') return;
          var href = link.getAttribute('href') || '';
          if (href.charAt(0) === '#') return;
          try { sessionStorage.setItem(returnPanelKey, panel.id); } catch (err) {}
        }, { capture: true });

        if (window.matchMedia('(max-width: 760px)').matches) {
          panels.forEach(function (p) { p.classList.add('is-active'); });
          function syncTopbar() {
            if (!topbar) return;
            var hero = document.getElementById('hero');
            var edge = hero ? hero.offsetHeight - 16 : window.innerHeight * 0.85;
            topbar.classList.toggle('show', window.scrollY >= edge || topbar.classList.contains('is-menu-open'));
          }
          syncTopbar();
          var mobileInitial = takeReturnPanelIndex();
          if (mobileInitial >= 0) {
            requestAnimationFrame(function () { panels[mobileInitial].scrollIntoView(); });
          }
          window.addEventListener('scroll', syncTopbar, { passive: true });
          window.addEventListener('resize', syncTopbar);
          return;
        }
        // own the scroll position so the panel deck lands exactly on section boundaries.
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var fine = window.matchMedia('(pointer: fine)').matches;
        var current = 0, animating = false, cooldownUntil = 0;

        function setActive(i) {
          current = i;
          panels.forEach(function (p, j) { p.classList.toggle('is-active', j === i); });
          if (topbar) topbar.classList.toggle('show', i > 0);
        }

        var io = new IntersectionObserver(function (entries) {
          if (animating) return;
          entries.forEach(function (e) {
            if (e.isIntersecting && e.intersectionRatio >= 0.55) setActive(panels.indexOf(e.target));
          });
        }, { threshold: [0.55] });
        panels.forEach(function (p) { io.observe(p); });
        var initial = takeReturnPanelIndex();
        if (initial < 0) initial = 0;
        window.scrollTo(0, panels[initial].offsetTop);
        setActive(initial);

        window.addEventListener('pageshow', function (e) {
          if (!e.persisted) return;
          var restored = takeReturnPanelIndex();
          if (restored >= 0) {
            window.scrollTo(0, panels[restored].offsetTop);
            setActive(restored);
            return;
          }
          var nearest = 0, best = Infinity;
          panels.forEach(function (p, i) {
            var dist = Math.abs(window.scrollY - p.offsetTop);
            if (dist < best) { best = dist; nearest = i; }
          });
          setActive(nearest);
        });

        function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

        function tweenTo(y, dur) {
          if (reduce) { window.scrollTo(0, y); return; }
          animating = true;
          var start = window.scrollY, dist = y - start, t0 = performance.now();
          if (Math.abs(dist) < 1) { animating = false; return; }
          (function frame(now) {
            var p = Math.min(1, (now - t0) / dur);
            window.scrollTo(0, start + dist * ease(p));
            if (p < 1) requestAnimationFrame(frame);
            else { animating = false; cooldownUntil = performance.now() + 240; }
          })(t0);
        }

        function go(i) {
          i = Math.max(0, Math.min(panels.length - 1, i));
          if (i === current && Math.abs(window.scrollY - panels[i].offsetTop) < 2) return;
          var steps = Math.abs(i - current) || 1;
          setActive(i);
          tweenTo(panels[i].offsetTop, Math.min(720 + steps * 110, 1100));
        }

        function overflowing(p) { return p.scrollHeight > window.innerHeight + 4; }

        if (fine && !reduce) {
          window.addEventListener('wheel', function (e) {
            if (e.ctrlKey) return;
            var dir = e.deltaY > 0 ? 1 : -1, p = panels[current];
            if (overflowing(p)) {
              var atTop = window.scrollY <= p.offsetTop + 2;
              var atBottom = window.scrollY + window.innerHeight >= p.offsetTop + p.scrollHeight - 2;
              if ((dir > 0 && !atBottom) || (dir < 0 && !atTop)) return;
            }
            if (current === panels.length - 1 && window.scrollY > p.offsetTop + 2) return;
            if (dir > 0 && current === panels.length - 1) return;
            e.preventDefault();
            if (animating || performance.now() < cooldownUntil || Math.abs(e.deltaY) < 6) return;
            go(current + dir);
          }, { passive: false });

          window.addEventListener('keydown', function (e) {
            var tag = (document.activeElement && document.activeElement.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            var map = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 };
            if (e.key === 'Home') { e.preventDefault(); go(0); return; }
            if (e.key === 'End') { e.preventDefault(); go(panels.length - 1); return; }
            if (!(e.key in map)) return;
            e.preventDefault();
            if (animating || performance.now() < cooldownUntil) return;
            go(current + map[e.key]);
          });
        }

        document.querySelectorAll('a[href^="#"]').forEach(function (a) {
          a.addEventListener('click', function (e) {
            var el = document.getElementById(a.getAttribute('href').slice(1));
            var idx = panels.indexOf(el);
            if (idx < 0) return;
            e.preventDefault();
            go(idx);
          });
        });

        window.addEventListener('resize', function () {
          if (!animating) window.scrollTo(0, panels[current].offsetTop);
        });
      })();
    </script>`;
}

function themeToggle() {
  return `<button class="theme-toggle" type="button" aria-label="Toggle dark mode" onclick="toggleTheme()">
            <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
          </button>`;
}

function menuToggle() {
  return `<button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false">
            <span class="menu-line"></span>
            <span class="menu-line"></span>
            <span class="menu-line"></span>
          </button>`;
}

// runs in <head> before paint so the saved theme applies with no flash
function themeInitScript() {
  return `<script>(function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();</script>`;
}

function projectBannerEl(project, escapeHtmlFn, pipeline, depth = 2) {
  if (!project.banner) return "";
  const banner = project.banner.trim().replace(/^['"]|['"]$/g, "");
  if (/^#[0-9a-f]{3,8}$/i.test(banner)) {
    return `<div class="project-banner-line" style="background:${escapeHtmlFn(banner)}" aria-hidden="true"></div>`;
  }
  const src =
    banner.startsWith("http://") ||
    banner.startsWith("https://") ||
    banner.startsWith("/")
      ? banner
      : `/${banner.replace(/^\.\//, "")}`;
  const resolved = pipeline ? pipeline.rewriteSrc(src.replace(/^\//, ""), depth) : src.replace(/^\//, "");
  return `<div class="project-banner"><img src="${escapeHtmlFn(resolved)}" alt="${escapeHtmlFn(project.title)} logo" width="658" height="344" decoding="async" loading="lazy" /></div>`;
}

function topbar(base, active) {
  const link = (key, href, label) =>
    `<a href="${href}" class="${active === key ? "active" : ""}">${label}</a>`;
  return `
      <header class="topbar">
        <div class="topbar-inner">
          <a class="mark" href="${base}">vedant misra</a>
          <div class="topbar-actions">
            ${themeToggle()}
            ${menuToggle()}
          </div>
          <nav>
            ${link("work", `${base}work/`, "work")}
            ${link("writing", `${base}writing/`, "writing")}
            ${link("about", `${base}about/`, "about")}
            <a href="mailto:${EMAIL}">email</a>
          </nav>
        </div>
      </header>`;
}

function footer() {
  return `
      <footer class="footer">
        <div class="footer-inner">
          <span>Vedant Misra</span>
          <div class="links">
            <a href="mailto:${EMAIL}">Email</a>
            <a href="${X_URL}" target="_blank" rel="noopener noreferrer">X (Twitter)</a>
            <a href="${GH_URL}" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>
      </footer>`;
}

function themeScriptBody() {
  return `
      var themeAudioContext = null;

      function getThemeAudioContext() {
        if (!themeAudioContext) {
          themeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return themeAudioContext;
      }

      function shouldPlayThemeSound() {
        return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }

      function connectThemeGain(ctx, amount) {
        var gain = ctx.createGain();
        gain.gain.value = amount;
        gain.connect(ctx.destination);
        return gain;
      }

      function playUiWikiClick(ctx, output, amount) {
        var t = ctx.currentTime;
        var noise = ctx.createBufferSource();
        var buf = ctx.createBuffer(1, ctx.sampleRate * 0.008, ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 50);
        }
        noise.buffer = buf;

        var filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 4000 + Math.random() * 1000;
        filter.Q.value = 3;

        var gain = ctx.createGain();
        gain.gain.value = amount * (0.5 + Math.random() * 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(output);
        noise.start(t);
        noise.onended = function () {
          noise.disconnect();
          filter.disconnect();
          gain.disconnect();
        };
      }

      function playUiWikiToggle(ctx, output, amount) {
        var t = ctx.currentTime;

        var noise = ctx.createBufferSource();
        var buf = ctx.createBuffer(1, ctx.sampleRate * 0.012, ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 80);
        }
        noise.buffer = buf;

        var filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2500;
        filter.Q.value = 4;

        var gain = ctx.createGain();
        gain.gain.value = amount * 0.4;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(output);
        noise.start(t);
        noise.onended = function () {
          noise.disconnect();
          filter.disconnect();
          gain.disconnect();
        };

        var osc = ctx.createOscillator();
        var oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.03);
        oscGain.gain.setValueAtTime(amount * 0.15, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.connect(oscGain);
        oscGain.connect(output);
        osc.start(t);
        osc.stop(t + 0.04);
        osc.onended = function () {
          osc.disconnect();
          oscGain.disconnect();
        };
      }

      function playUiWikiPop(ctx, output, amount) {
        var t = ctx.currentTime;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.04);

        gain.gain.setValueAtTime(amount * 0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        osc.connect(gain);
        gain.connect(output);
        osc.start(t);
        osc.stop(t + 0.05);
        osc.onended = function () {
          osc.disconnect();
          gain.disconnect();
        };
      }

      function playUiWikiTick(ctx, output, amount) {
        var t = ctx.currentTime;
        var noise = ctx.createBufferSource();
        var buf = ctx.createBuffer(1, ctx.sampleRate * 0.004, ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 20);
        }
        noise.buffer = buf;

        var filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 3000;

        var gain = ctx.createGain();
        gain.gain.value = amount * 0.3;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(output);
        noise.start(t);
        noise.onended = function () {
          noise.disconnect();
          filter.disconnect();
          gain.disconnect();
        };
      }

      function playBookTock(ctx, output, amount) {
        var t = ctx.currentTime;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        var filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(145, t + 0.055);
        filter.type = 'lowpass';
        filter.frequency.value = 1100;
        gain.gain.setValueAtTime(amount * 0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(output);
        osc.start(t);
        osc.stop(t + 0.07);
        osc.onended = function () {
          osc.disconnect();
          filter.disconnect();
          gain.disconnect();
        };
      }

      function playThemeSound(kind) {
        try {
          if (!shouldPlayThemeSound()) return;
          var ctx = getThemeAudioContext();
          function play() {
            var output = connectThemeGain(ctx, 0.72);
            if (kind === 'toggle') playUiWikiToggle(ctx, output, 0.52);
            else if (kind === 'pop') playUiWikiPop(ctx, output, 0.48);
            else if (kind === 'tick') playUiWikiTick(ctx, output, 0.58);
            else if (kind === 'book') playBookTock(ctx, output, 0.8);
            else playUiWikiClick(ctx, output, kind === 'theme' ? 0.95 : 0.42);
            window.setTimeout(function () { output.disconnect(); }, 180);
          }
          if (ctx.state === 'suspended') ctx.resume().then(play).catch(function () {});
          else play();
        } catch (e) {}
      }

      function playThemeClick() {
        playThemeSound('theme');
      }

      function toggleTheme() {
        playThemeClick();
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
      }

      (function () {
        var soundSelectors = [
          ['.theme-toggle', 'none'],
          ['[data-sound="none"]', 'none'],
          ['.menu-toggle', 'none'],
          ['.depth-toggle', 'toggle'],
          ['.section-toggle', 'toggle'],
          ['.book', 'book'],
          ['.lightbox-close', 'none'],
          ['.md-image', 'none'],
          ['.see-all', 'click'],
          ['.card', 'click'],
          ['.entry', 'click'],
          ['.work-text-item', 'click'],
          ['a[href]', 'click'],
          ['button', 'click'],
          ['[role="button"]', 'click']
        ];

        function soundForTarget(target) {
          if (!target || !target.closest) return '';
          if (target.classList && target.classList.contains('lightbox')) return '';
          if (target.closest('input, textarea, select, label')) return '';
          for (var i = 0; i < soundSelectors.length; i++) {
            var match = target.closest(soundSelectors[i][0]);
            if (match) return soundSelectors[i][1];
          }
          return '';
        }

        document.addEventListener('pointerdown', function (event) {
          if (event.button && event.button !== 0) return;
          var kind = soundForTarget(event.target);
          if (!kind || kind === 'none') return;
          playThemeSound(kind);
        }, { passive: true });
      })();`;
}

function menuScriptBody() {
  return `
      (function () {
        document.querySelectorAll('.topbar').forEach(function (bar) {
          var btn = bar.querySelector('.menu-toggle');
          var nav = bar.querySelector('nav');
          if (!btn || !nav) return;

          function setOpen(open) {
            bar.classList.toggle('is-menu-open', open);
            document.body.classList.toggle('menu-open', open);
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            if (bar.classList.contains('topbar-home') && open) bar.classList.add('show');
            if (bar.classList.contains('topbar-home') && !open) {
              var hero = document.getElementById('hero');
              var edge = hero ? hero.offsetHeight - 16 : window.innerHeight * 0.85;
              bar.classList.toggle('show', window.scrollY >= edge);
            }
          }

          btn.addEventListener('click', function () {
            setOpen(!bar.classList.contains('is-menu-open'));
          });
          nav.addEventListener('click', function (e) {
            if (e.target.closest('a')) setOpen(false);
          });
          document.addEventListener('click', function (e) {
            if (!bar.contains(e.target)) setOpen(false);
          });
          document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') setOpen(false);
          });
        });
      })();`;
}

function smoothScrollBody() {
  return `
      (function () {
        if (document.querySelector('.panel')) return;
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var fine = window.matchMedia('(pointer: fine)').matches;
        if (reduce || !fine) return;

        var target = window.scrollY;
        var current = target;
        var raf = null;
        var ease = 0.075;
        var wheelScale = 0.72;

        function maxScroll() {
          return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        }

        function tick() {
          current += (target - current) * ease;
          if (Math.abs(target - current) < 0.5) {
            current = target;
            window.scrollTo(0, current);
            raf = null;
            return;
          }
          window.scrollTo(0, current);
          raf = requestAnimationFrame(tick);
        }

        function schedule() {
          if (!raf) raf = requestAnimationFrame(tick);
        }

        window.addEventListener('wheel', function (e) {
          if (e.ctrlKey) return;
          var tag = (document.activeElement && document.activeElement.tagName) || '';
          if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable) return;
          e.preventDefault();
          target = Math.max(0, Math.min(maxScroll(), target + e.deltaY * wheelScale));
          schedule();
        }, { passive: false });

        window.addEventListener('scroll', function () {
          if (!raf) {
            target = window.scrollY;
            current = target;
          }
        }, { passive: true });

        window.addEventListener('keydown', function (e) {
          var tag = (document.activeElement && document.activeElement.tagName) || '';
          if (tag === 'INPUT' || tag === 'TEXTAREA') return;
          var step = window.innerHeight * 0.72;
          if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
            e.preventDefault();
            target = Math.min(maxScroll(), target + step);
            schedule();
          } else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
            e.preventDefault();
            target = Math.max(0, target - step);
            schedule();
          } else if (e.key === 'Home') {
            e.preventDefault();
            target = 0;
            schedule();
          } else if (e.key === 'End') {
            e.preventDefault();
            target = maxScroll();
            schedule();
          }
        });
      })();`;
}

function siteScriptBundle() {
  return [themeScriptBody(), menuScriptBody(), lightboxScriptBody, smoothScrollBody()].join("\n");
}

async function writeSiteBundles(root) {
  const assetsDir = path.join(root, "assets");
  await fs.mkdir(assetsDir, { recursive: true });
  await copyFonts(assetsDir);

  const css = minifyCss(styles());
  const js = minifyJs(siteScriptBundle());
  const cssName = `site.${contentHash(css)}.css`;
  const jsName = `site.${contentHash(js)}.js`;

  await fs.writeFile(path.join(assetsDir, cssName), css);
  await fs.writeFile(path.join(assetsDir, jsName), js);

  return { css: cssName, js: jsName };
}

function shell({
  title,
  body,
  depth,
  analytics,
  deck = false,
  extraScript = "",
  bundles,
  headExtras = "",
  description = SITE_DESCRIPTION,
  canonicalPath: pagePath = "/",
  image = DEFAULT_SOCIAL_IMAGE,
  imageAlt = SITE_TITLE,
  ogType = "website",
  publishedTime = "",
  modifiedTime = "",
  articleSection = "",
  structuredData = [],
}) {
  const root = depth === 1 ? "" : "../";
  return `<!doctype html>
<html lang="en" prefix="og: https://ogp.me/ns#">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
${seoHead({
  root,
  title,
  description,
  path: pagePath,
  image,
  imageAlt,
  ogType,
  publishedTime,
  modifiedTime,
  articleSection,
  structuredData,
})}
    ${fontPreloads(root)}
    <link rel="stylesheet" href="${root}assets/${bundles.css}" />
    ${headExtras}
    ${themeInitScript()}
  </head>
  <body>
${body}
${footer()}
${analytics()}
<script defer src="${root}assets/${bundles.js}"></script>
${extraScript}
  </body>
</html>`;
}

export async function buildSite({
  rootDir,
  contentDir,
  projectsDir,
  blogDir,
  loadCollection,
  loadLogs,
  markdownToHtml,
  escapeHtml,
  formatDate,
  ensureDir,
  writeFile,
  vercelAnalyticsScript,
}) {
  const root = path.join(rootDir, "site");
  await fs.rm(root, { recursive: true, force: true }).catch(() => {});
  const projects = await loadCollection(projectsDir, "project");
  const posts = await loadCollection(blogDir, "blog");
  const logs = await loadLogs();
  const home = JSON.parse(await fs.readFile(path.join(contentDir, "preview", "home.json"), "utf8"));
  const aboutRaw = await fs.readFile(path.join(contentDir, "preview", "about.md"), "utf8");
  const aboutPageRaw = await fs.readFile(path.join(contentDir, "preview", "about-page.md"), "utf8");
  const aboutMiscRaw = await fs.readFile(path.join(contentDir, "preview", "about-misc.md"), "utf8");
  const highlights = JSON.parse(await fs.readFile(path.join(contentDir, "preview", "highlights.json"), "utf8"));

  const books = JSON.parse(await fs.readFile(path.join(contentDir, "preview", "books.json"), "utf8"));

  await ensureDir(path.join(root, "assets"));
  await ensureDir(path.join(root, "assets", "books"));
  await ensureDir(path.join(root, "about"));
  await ensureDir(path.join(root, "work"));
  await ensureDir(path.join(root, "writing"));
  await writeFavicon(root);

  const bundles = await writeSiteBundles(root);
  const pipeline = new ImagePipeline(rootDir, root);
  const sitemapEntries = [];

  const portraitSrc = (
    await pipeline.ingest("content/preview/portrait.png", "assets/portrait.webp", {
      maxWidth: 640,
      quality: 80,
    })
  ).replace(/^\//, "");

  const imageRefs = new Set();
  for (const text of [aboutRaw, aboutPageRaw, aboutMiscRaw]) {
    for (const ref of collectMarkdownImages(text)) imageRefs.add(ref);
  }
  for (const item of highlights) {
    if (item.image) imageRefs.add(item.image.replace(/^\.?\//, ""));
  }

  const homeProjectSlugs = ["friday", "sakhi"];
  const homeProjects = homeProjectSlugs
    .map((slug) => projects.find((p) => p.slug === slug))
    .filter(Boolean);
  const homeWritingHighlightSlug = home.writing?.highlight ?? "broke-countries-build-different";
  const homeWritingHighlight =
    posts.find((p) => p.slug === homeWritingHighlightSlug) ?? posts[0];
  const homeWritingMore = posts.filter((p) => p.slug !== homeWritingHighlight?.slug);
  const siteLastmod = latestIsoDate([
    ...posts.map((post) => post.date),
    ...projects.map((project) => project.date),
  ]);

  // resolve a card image for an item, in priority order:
  //   1. frontmatter `image:` field
  //   2. drop-in convention: images/cards/<slug>.{png,jpg,jpeg,webp}
  //   3. first image used in the body
  // ...then copy it into assets/<subdir>; if none found, use a seeded gradient.
  const prepMedia = async (item, subdir) => {
    await ensureDir(path.join(root, "assets", subdir));
    const candidates = [];
    if (item.image) candidates.push(item.image.replace(/^\.?\//, ""));
    for (const ext of ["webp", "png", "jpg", "jpeg"]) candidates.push(`images/cards/${item.slug}.${ext}`);
    const bodyImg = item.body.match(/!\[[^\]]*\]\(([^)]+)\)/);
    if (bodyImg) candidates.push(bodyImg[1].trim().replace(/^\.?\//, ""));

    item.cardImg = null;
    for (const src of candidates) {
      try {
        await fs.access(path.join(rootDir, src));
        imageRefs.add(src);
        const optimized = await pipeline.ingest(src, `assets/${subdir}/${item.slug}${path.extname(src) || ".png"}`, {
          maxWidth: 900,
          quality: 82,
        });
        item.cardImg = optimized.replace(/^\//, "");
        break;
      } catch {}
    }
    if (!item.cardImg) {
      const hue = strHash(item.slug) % 360;
      item.cardPh = `linear-gradient(135deg, hsl(${hue} 42% 84%), hsl(${(hue + 45) % 360} 46% 70%))`;
    }
  };
  for (const p of projects) {
    for (const ref of collectMarkdownImages(p.body)) imageRefs.add(ref);
    if (p.banner && !/^#/.test(p.banner.trim()) && !/^https?:\/\//i.test(p.banner.trim())) {
      imageRefs.add(p.banner.trim().replace(/^\.?\//, ""));
    }
  }
  for (const post of posts) {
    for (const ref of collectMarkdownImages(post.body)) imageRefs.add(ref);
    if (post.image) imageRefs.add(post.image.replace(/^\.?\//, ""));
  }
  for (const p of homeProjects) await prepMedia(p, "work");
  if (homeWritingHighlight) await prepMedia(homeWritingHighlight, "writing");
  for (const p of projects) await prepMedia(p, "work");
  for (const post of posts) await prepMedia(post, "writing");

  for (const ref of imageRefs) {
    if (!ref || ref.startsWith("http")) continue;
    try {
      await pipeline.ingest(ref, ref, { maxWidth: 1400, quality: 82 });
    } catch {}
  }

  const renderMarkdown = (body, depth = 2) =>
    normalCapitalizationHtml(pipeline.rewriteHtml(markdownToHtml(body), depth));

  const mediaEl = (item, root = "", alt = item.title) => {
    if (item.cardImg) {
      return `<img class="card-media" src="${escapeHtml(root)}${escapeHtml(item.cardImg)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" width="900" height="675" />`;
    }
    return `<span class="card-media" style="background:${item.cardPh}"></span>`;
  };

  const pageImage = (item) => item?.cardImg || DEFAULT_SOCIAL_IMAGE;
  const sitemapImage = (src) => String(src || "").replace(/^(\.\.\/)+/, "").replace(/^\.?\//, "");
  const markdownSitemapImages = (body) =>
    [...collectMarkdownImages(body || "")]
      .map((ref) => pipeline.rewriteSrc(ref, 1))
      .map(sitemapImage)
      .filter(Boolean);

  const cardEl = (item, href, i, { root = "" } = {}) => {
    const reveal = i == null ? "" : ` data-reveal style="--i:${i}"`;
    return `
            <a class="card"${reveal} href="${href}">
              <span class="card-media-wrap">${mediaEl(item, root, item.title)}</span>
              <span class="card-title">${escapeHtml(normalCapitalization(item.title))}</span>
              <span class="card-desc">${escapeHtml(normalCapitalization(item.summary))}</span>
            </a>`;
  };

  const writingHome = (lead, more = [], i = 1) => {
    if (!lead) return "";
    const meta = [formatDate(lead.date), lead.readTime].filter(Boolean).join(" · ");
    const leadEl = `
      <a class="card writing-hero" data-reveal style="--i:${i}" href="writing/${lead.slug}.html">
        <span class="card-media-wrap">${mediaEl(lead, "", lead.title)}</span>
      </a>`;
    const detailEl = `
      <div class="writing-detail" data-reveal style="--i:${i + 1}">
        <p class="writing-kicker">Featured Essay</p>
        <h3 class="writing-detail-title">
          <a href="writing/${lead.slug}.html">${escapeHtml(normalCapitalization(lead.title))}</a>
        </h3>
        ${meta ? `<p class="writing-detail-meta">${escapeHtml(normalCapitalization(meta))}</p>` : ""}
        <p class="writing-detail-desc">${escapeHtml(normalCapitalization(lead.summary))}</p>
      </div>`;
    const moreItems = (more || []).slice(0, 2);
    const moreEl = moreItems.length
      ? `
      <div class="writing-more" data-reveal style="--i:${i + 2}">
        <div class="writing-more-grid">
          ${moreItems
            .map((p, idx) => {
              const itemMeta = [formatDate(p.date), p.readTime].filter(Boolean).join(" · ");
              return `
          <a class="entry" href="writing/${p.slug}.html">
            <span class="entry-index">${String(idx + 2).padStart(2, "0")}</span>
            <span class="entry-copy">
              <span class="entry-title">${escapeHtml(normalCapitalization(p.title))}</span>
              <span class="entry-desc">${escapeHtml(normalCapitalization(p.summary))}</span>
            </span>
            <span class="entry-meta">
              ${itemMeta ? `<span>${escapeHtml(normalCapitalization(itemMeta))}</span>` : ""}
              <span class="entry-arrow" aria-hidden="true">&rarr;</span>
            </span>
          </a>`;
            })
            .join("")}
        </div>
      </div>`
      : "";
    return `<div class="writing-layout">${leadEl}${detailEl}</div>${moreEl}`;
  };

  const writingCard = (item, href, root = "") => {
    const meta = [formatDate(item.date), item.readTime].filter(Boolean).join(" · ");
    return `
            <a class="card" href="${href}">
              <span class="card-media-wrap">${mediaEl(item, root, item.title)}</span>
              <span class="card-title">${escapeHtml(normalCapitalization(item.title))}</span>
              <span class="card-desc">${escapeHtml(normalCapitalization(item.summary))}</span>
              ${meta ? `<span class="card-meta">${escapeHtml(normalCapitalization(meta))}</span>` : ""}
            </a>`;
  };

  const entry = (href, title, sub, meta, i) => `
          <a class="entry"${i == null ? "" : ` data-reveal style="--i:${i}"`} href="${href}">
            <div class="entry-row">
              <h3 class="entry-title">${escapeHtml(normalCapitalization(title))}</h3>
              ${meta ? `<span class="entry-meta">${escapeHtml(normalCapitalization(meta))}</span>` : ""}
            </div>
            ${sub ? `<p class="entry-sub">${escapeHtml(normalCapitalization(sub))}</p>` : ""}
          </a>`;

  // ---- home (one-pager, full-page deck) ----
  const homeBody = `
    <header class="topbar topbar-home">
      <div class="topbar-inner">
        <a class="mark" href="#hero">vedant misra</a>
        <div class="topbar-actions">
          ${themeToggle()}
          ${menuToggle()}
        </div>
        <nav>
          <a href="work/">work</a>
          <a href="writing/">writing</a>
          <a href="about/">about</a>
          <a href="mailto:${EMAIL}">email</a>
        </nav>
      </div>
    </header>

    <main>
      <section class="hero panel" id="hero">
        <div class="hero-inner">
          <div class="hero-identity" data-reveal style="--i:0">
            <p class="hero-identity-name">${escapeHtml(normalCapitalization(home.hero.name))}</p>
          </div>
          <div class="hero-thesis" data-reveal style="--i:1">
            <h1>${escapeHtml(normalCapitalization(home.hero.thesis || "")).replace(/\s*\n\s*/g, " ")}</h1>
          </div>
          <div class="hero-map" data-reveal style="--i:2">
            <p class="hero-map-label">See My</p>
            <nav class="hero-map-grid" aria-label="Explore the site">
              ${(home.hero.map || []).map((item) => `
                <a class="hero-map-link" href="${escapeHtml(item.href)}">
                  <strong>${escapeHtml(normalCapitalization(item.label))}</strong>
                </a>
              `).join("")}
            </nav>
          </div>
        </div>
      </section>

      <section class="section panel" id="about">
        <div class="wrap">
          <h2 class="sec-title" data-reveal style="--i:0">About</h2>
          <div class="about-grid">
            <div>
              <div class="about-body" data-reveal style="--i:1">${renderMarkdown(aboutRaw)}</div>
              <div class="contact" data-reveal style="--i:2">
                <a href="mailto:${EMAIL}">Email</a><span class="dot">·</span>
                <a href="${X_URL}" target="_blank" rel="noopener noreferrer">X (Twitter)</a><span class="dot">·</span>
                <a href="${GH_URL}" target="_blank" rel="noopener noreferrer">GitHub</a>
              </div>
            </div>
            <img class="portrait" data-reveal style="--i:1" src="${portraitSrc}" alt="Vedant Misra" width="320" height="427" loading="lazy" decoding="async" />
          </div>
        </div>
      </section>

      <section class="section panel" id="writing">
        <div class="wrap">
          <div class="sec-head">
            <a class="sec-title sec-title-link" data-reveal style="--i:0" href="writing/">Writing</a>
            <a class="see-all" data-reveal style="--i:0" href="writing/">See All <span class="arr">→</span></a>
          </div>
          ${writingHome(homeWritingHighlight, homeWritingMore)}
        </div>
      </section>

      <section class="section panel" id="work">
        <div class="wrap">
          <div class="sec-head">
            <a class="sec-title sec-title-link" data-reveal style="--i:0" href="work/">Work</a>
            <a class="see-all" data-reveal style="--i:0" href="work/">See All <span class="arr">→</span></a>
          </div>
          <div class="work-cards">
            ${homeProjects.map((p, i) => cardEl(p, `work/${p.slug}.html`, i + 1)).join("")}
          </div>
        </div>
      </section>

      <!--
      <section class="section panel" id="reading">
        <div class="wrap">
          <div class="sec-head">
            <h2 class="sec-title" data-reveal style="--i:0">Reading</h2>
            <a class="see-all" data-reveal style="--i:0" href="about/#bookshelf">Bookshelf <span class="arr">→</span></a>
          </div>
          <div class="reading-block">
            <p class="eyebrow" data-reveal style="--i:1">Currently</p>
            <p class="reading-title" data-reveal style="--i:2">${escapeHtml(home.reading.title)}</p>
            <p class="reading-author" data-reveal style="--i:3">by ${escapeHtml(home.reading.author)}</p>
            ${home.reading.note ? `<p class="reading-note" data-reveal style="--i:4">${escapeHtml(normalCapitalization(home.reading.note))}</p>` : ""}
          </div>
        </div>
      </section>
      -->
    </main>

    `;

  const homeTitle = `${SITE_TITLE} | AI Builder and Product Engineer`;
  const homeDescription = SITE_DESCRIPTION;
  await writeFile(
    path.join(root, "index.html"),
    shell({
      title: homeTitle,
      body: homeBody,
      depth: 1,
      analytics: vercelAnalyticsScript,
      deck: true,
      bundles,
      canonicalPath: "/",
      description: homeDescription,
      image: portraitSrc,
      imageAlt: SITE_TITLE,
      structuredData: [
        personSchema(),
        websiteSchema(),
        {
          ...webpageSchema({
            type: "ProfilePage",
            path: "/",
            title: homeTitle,
            description: homeDescription,
            image: portraitSrc,
          }),
          mainEntity: { "@id": PERSON_ID },
        },
      ],
      extraScript: deckScript(),
    })
  );
  sitemapEntries.push({ path: "/", lastmod: siteLastmod, images: [portraitSrc] });

  // ---- writing list ----
  const writingHighlight =
    posts.find((p) => p.slug === homeWritingHighlightSlug) ?? posts[0];
  const writingOthers = posts.filter((p) => p.slug !== writingHighlight?.slug);

  const writingList = `
    ${topbar("../", "writing")}
    <main class="wrap page-writing">
      <div class="article-head">
        <h1>Writing</h1>
        <p class="lead">Essays on AI, India, and what actually changes people's lives.</p>
      </div>
      ${writingHighlight ? `<div class="writing-tier writing-tier-main">${writingCard(writingHighlight, `${writingHighlight.slug}.html`, relRoot(2))}</div>` : ""}
      ${
        writingOthers.length
          ? `<div class="writing-tier writing-tier-more">
        <p class="work-tier-label">more</p>
        <div class="writing-grid">
          ${writingOthers.slice(0, 2).map((p) => writingCard(p, `${p.slug}.html`, relRoot(2))).join("")}
        </div>
        ${
          writingOthers.length > 2
            ? `<div class="writing-grid">
          ${writingOthers.slice(2).map((p) => writingCard(p, `${p.slug}.html`, relRoot(2))).join("")}
        </div>`
            : ""
        }
      </div>`
          : ""
      }
    </main>`;
  const writingTitle = `Writing | ${SITE_TITLE}`;
  const writingDescription = "Essays by Vedant Misra on AI, India, product, healthcare, and building technology for real-world constraints.";
  await writeFile(
    path.join(root, "writing", "index.html"),
    shell({
      title: writingTitle,
      body: writingList,
      depth: 2,
      analytics: vercelAnalyticsScript,
      bundles,
      canonicalPath: "/writing/",
      description: writingDescription,
      image: pageImage(writingHighlight),
      imageAlt: writingHighlight?.title || "Writing by Vedant Misra",
      structuredData: [
        webpageSchema({
          type: "CollectionPage",
          path: "/writing/",
          title: writingTitle,
          description: writingDescription,
          image: pageImage(writingHighlight),
        }),
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Writing", path: "/writing/" },
        ]),
        itemListSchema(
          posts.map((post) => ({
            name: post.title,
            path: `/writing/${post.slug}.html`,
          }))
        ),
      ],
    })
  );
  sitemapEntries.push({
    path: "/writing/",
    lastmod: latestIsoDate(posts.map((post) => post.date)),
    images: [pageImage(writingHighlight)],
  });

  // ---- individual posts ----
  for (const post of posts) {
    const meta = [formatDate(post.date), post.readTime].filter(Boolean).join(" · ");
    const postTitle = `${post.title} | ${SITE_TITLE}`;
    const postDescription = metaDescription(post.summary || excerptOf(post.body));
    const postPath = `/writing/${post.slug}.html`;
    const postImage = pageImage(post);
    const body = `
    ${topbar("../", "writing")}
    <main class="wrap">
      <div class="article-head">
          <h1>${escapeHtml(normalCapitalization(post.title))}</h1>
        ${post.summary ? `<p class="lead">${escapeHtml(normalCapitalization(post.summary))}</p>` : ""}
        ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ""}
      </div>
      <article class="prose">${renderMarkdown(post.body)}</article>
    </main>`;
    await writeFile(
      path.join(root, "writing", `${post.slug}.html`),
      shell({
        title: postTitle,
        body,
        depth: 2,
        analytics: vercelAnalyticsScript,
        bundles,
        canonicalPath: postPath,
        description: postDescription,
        image: postImage,
        imageAlt: post.title,
        ogType: "article",
        publishedTime: post.date,
        modifiedTime: post.date,
        articleSection: "Writing",
        structuredData: [
          webpageSchema({
            type: "WebPage",
            path: postPath,
            title: postTitle,
            description: postDescription,
            image: postImage,
          }),
          {
            "@type": "BlogPosting",
            "@id": `${absoluteUrl(postPath)}#article`,
            headline: post.title,
            description: postDescription,
            image: [absoluteUrl(postImage)],
            datePublished: post.date ? isoDate(post.date) : undefined,
            dateModified: post.date ? isoDate(post.date) : undefined,
            author: { "@id": PERSON_ID },
            publisher: { "@id": PERSON_ID },
            mainEntityOfPage: { "@id": `${absoluteUrl(postPath)}#webpage` },
            inLanguage: "en",
          },
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Writing", path: "/writing/" },
            { name: post.title, path: postPath },
          ]),
        ],
      })
    );
    sitemapEntries.push({
      path: postPath,
      lastmod: post.date || siteLastmod,
      images: [postImage, ...markdownSitemapImages(post.body)],
    });
  }

  // ---- work list ----
  const friday = projects.find((p) => p.slug === "friday");
  const sakhi = projects.find((p) => p.slug === "sakhi");
  const otherProjects = projects.filter((p) => p.slug !== "friday" && p.slug !== "sakhi");

  const workList = `
    ${topbar("../", "work")}
    <main class="wrap page-work">
      <div class="article-head">
        <h1>Work</h1>
        <p class="lead">Things I've built. Product first, not demos for demo's sake.</p>
      </div>
      ${friday ? `<div class="work-tier work-tier-main">${cardEl(friday, `${friday.slug}.html`, null, { root: relRoot(2) })}</div>` : ""}
      ${sakhi ? `<div class="work-tier work-tier-main">${cardEl(sakhi, `${sakhi.slug}.html`, null, { root: relRoot(2) })}</div>` : ""}
      ${
        otherProjects.length
          ? `<div class="work-tier work-tier-more">
        <p class="work-tier-label">Firsts</p>
        <p class="work-tier-note">From the early days of my building journey. Clippy was my first macOS app. Odds was my first app with real users. Image Cartoonification was my first time implementing a research paper. CatGPT was the first website I deployed on the internet. Might seem small, but they had some important learnings for me :)</p>
        <div class="work-text-list">
          ${otherProjects
            .map(
              (p) => `<a class="work-text-item" href="${p.slug}.html">
            <span class="work-text-title">${escapeHtml(normalCapitalization(p.title))}</span>
            <span class="work-text-desc">${escapeHtml(normalCapitalization(p.summary))}</span>
          </a>`
            )
            .join("")}
        </div>
      </div>`
          : ""
      }
    </main>`;
  const workTitle = `Work | ${SITE_TITLE}`;
  const workDescription = "Product and AI projects by Vedant Misra, including Friday, Sakhi, Clippy, CatGPT, Odds, and implementation work from India.";
  await writeFile(
    path.join(root, "work", "index.html"),
    shell({
      title: workTitle,
      body: workList,
      depth: 2,
      analytics: vercelAnalyticsScript,
      bundles,
      canonicalPath: "/work/",
      description: workDescription,
      image: pageImage(friday || sakhi || projects[0]),
      imageAlt: "Work by Vedant Misra",
      structuredData: [
        webpageSchema({
          type: "CollectionPage",
          path: "/work/",
          title: workTitle,
          description: workDescription,
          image: pageImage(friday || sakhi || projects[0]),
        }),
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Work", path: "/work/" },
        ]),
        itemListSchema(
          projects.map((project) => ({
            name: project.title,
            path: `/work/${project.slug}.html`,
          }))
        ),
      ],
    })
  );
  sitemapEntries.push({
    path: "/work/",
    lastmod: latestIsoDate(projects.map((project) => project.date)),
    images: [pageImage(friday || sakhi || projects[0])],
  });

  // ---- individual projects ----
  for (const project of projects) {
    const { story, technical } = splitProjectBody(project.body);
    const panelId = `depth-${project.slug}`;
    const metaBits = project.date ? formatDate(project.date) : "";
    const projectTitle = `${project.title} | ${SITE_TITLE}`;
    const projectDescription = metaDescription(project.summary || excerptOf(story));
    const projectPath = `/work/${project.slug}.html`;
    const projectImage = pageImage(project);
    const projectKeywords = project.stack
      ? project.stack
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const body = `
    ${topbar("../", "work")}
    ${projectBannerEl(project, escapeHtml, pipeline, 2)}
    <main class="wrap">
      <div class="article-head">
        <h1>${escapeHtml(normalCapitalization(project.title))}</h1>
        ${project.summary ? `<p class="lead">${escapeHtml(normalCapitalization(project.summary))}</p>` : ""}
        ${metaBits ? `<p class="meta">${escapeHtml(normalCapitalization(metaBits))}</p>` : ""}
        ${
          project.demo || project.repo
            ? `<div class="article-links">
          ${project.demo ? `<a href="${escapeHtml(project.demo)}" target="_blank" rel="noopener noreferrer">Demo</a>` : ""}
          ${project.repo ? `<a href="${escapeHtml(project.repo)}" target="_blank" rel="noopener noreferrer">Source</a>` : ""}
        </div>`
            : ""
        }
      </div>
      <article class="prose">
        ${renderMarkdown(story)}
        ${
          project.stack
            ? `<div class="chips">${project.stack
                .split(",")
                .map((s) => `<span class="chip">${escapeHtml(s.trim())}</span>`)
                .join("")}</div>`
            : ""
        }
        ${
          technical
            ? `<div class="depth">
          <button type="button" class="depth-toggle" aria-expanded="false" aria-controls="${panelId}">
            <span class="caret">›</span><span class="label">Technical Details</span>
          </button>
          <div class="depth-panel" id="${panelId}" hidden>${renderMarkdown(technical)}</div>
        </div>`
            : ""
        }
      </article>
    </main>`;
    await writeFile(
      path.join(root, "work", `${project.slug}.html`),
      shell({
        title: projectTitle,
        body,
        depth: 2,
        analytics: vercelAnalyticsScript,
        bundles,
        canonicalPath: projectPath,
        description: projectDescription,
        image: projectImage,
        imageAlt: project.title,
        structuredData: [
          webpageSchema({
            type: "WebPage",
            path: projectPath,
            title: projectTitle,
            description: projectDescription,
            image: projectImage,
          }),
          {
            "@type": project.repo ? "SoftwareSourceCode" : "CreativeWork",
            "@id": `${absoluteUrl(projectPath)}#project`,
            name: project.title,
            description: projectDescription,
            image: absoluteUrl(projectImage),
            dateCreated: project.date ? isoDate(project.date) : undefined,
            dateModified: project.date ? isoDate(project.date) : undefined,
            author: { "@id": PERSON_ID },
            creator: { "@id": PERSON_ID },
            url: absoluteUrl(projectPath),
            codeRepository: project.repo || undefined,
            sameAs: [project.repo, project.demo].filter(Boolean),
            keywords: projectKeywords.length ? projectKeywords.join(", ") : undefined,
            inLanguage: "en",
          },
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Work", path: "/work/" },
            { name: project.title, path: projectPath },
          ]),
        ],
        extraScript: technical ? depthScript() : "",
      })
    );
    sitemapEntries.push({
      path: projectPath,
      lastmod: project.date || siteLastmod,
      images: [projectImage, ...markdownSitemapImages(project.body)],
    });
  }

  // ---- about (highlights, misc, log, bookshelf) ----
  const days = [];
  const dayMap = new Map();
  for (const log of logs) {
    const [date, time = ""] = log.timestamp.split(" · ");
    if (!dayMap.has(date)) {
      const day = { date, entries: [] };
      days.push(day);
      dayMap.set(date, day);
    }
    dayMap.get(date).entries.push({ time, body: log.body });
  }

  const logHtml = days.length
    ? days
        .map(
          (day) => `
        <div class="log-day">
          <div class="log-date">${escapeHtml(day.date)}</div>
          ${day.entries
            .map(
              (e) => `<div class="log-entry">
            ${e.time ? `<div class="log-time">${escapeHtml(e.time)}</div>` : ""}
            <div>${renderMarkdown(e.body)}</div>
          </div>`
            )
            .join("")}
        </div>`
        )
        .join("")
    : `<p class="badge">no entries yet.</p>`;

  const coverExts = ["webp", "jpg", "jpeg", "png"];
  for (const b of books) {
    const jsonCover = b.coverFile;
    const jsonSpine = b.spineFile;
    b.slug = b.slug || slugify(b.title);
    b.coverFile = null;
    b.spineFile = null;

    const ingestBookFile = async (srcRel, destName, maxWidth) => {
      const srcFromRoot = path.join("content/preview", srcRel).split(path.sep).join("/");
      const out = await pipeline.ingest(
        srcFromRoot,
        `assets/books/${b.slug}-${destName}${path.extname(srcRel)}`,
        { maxWidth, quality: 80 }
      );
      return out.replace(/^\//, "");
    };

    if (jsonCover?.startsWith("books/")) {
      try {
        b.coverFile = await ingestBookFile(jsonCover, "cover", 440);
      } catch {
        b.coverFile = null;
      }
    }
    if (!b.coverFile) {
      for (const ext of coverExts) {
        const flat = path.join(contentDir, "preview", "books", `${b.slug}.${ext}`);
        try {
          await fs.access(flat);
          b.coverFile = await ingestBookFile(path.join("books", `${b.slug}.${ext}`), "cover", 440);
          break;
        } catch {}
      }
    }
    if (!b.coverFile) {
      for (const ext of coverExts) {
        const nested = path.join(contentDir, "preview", "books", b.slug, `cover.${ext}`);
        try {
          await fs.access(nested);
          b.coverFile = await ingestBookFile(path.join("books", b.slug, `cover.${ext}`), "cover", 440);
          break;
        } catch {}
      }
    }

    if (jsonSpine?.startsWith("books/")) {
      try {
        b.spineFile = await ingestBookFile(jsonSpine, "spine", 280);
      } catch {
        b.spineFile = null;
      }
    }
    if (!b.spineFile) {
      for (const ext of coverExts) {
        const nested = path.join(contentDir, "preview", "books", b.slug, `spine.${ext}`);
        try {
          await fs.access(nested);
          b.spineFile = await ingestBookFile(path.join("books", b.slug, `spine.${ext}`), "spine", 280);
          break;
        } catch {}
      }
    }
  }

  const ROWS = 2;
  const per = Math.ceil(books.length / ROWS);
  const bookRows = [];
  for (let i = 0; i < books.length; i += per) bookRows.push(books.slice(i, i + per));

  // spine thickness (px) scales with page count, fatter book means more pages
  const spineThick = (pages) => {
    const p = pages || 300;
    return Math.round(Math.max(28, Math.min(66, 22 + p * 0.066)));
  };

  const bookEl = (b) => {
    const p = b.pages || 300;
    // subtle per-title variation so the shelf doesn't look mechanical
    const h = Math.round(198 + Math.min(p, 720) * 0.03 + (strHash(b.title) % 7) * 5);
    const thick = spineThick(p);
    const w = Math.round(h * 0.66);
    const lean = (((strHash(b.title + "lean") % 13) - 6) * 0.3).toFixed(2);
    // title font: thickness sets the base size, but shrink it to fit the spine's
    // length when the title is long (~0.6 = avg glyph advance for the bold face),
    // so long titles like "The Hard Thing About Hard Things" stay on one line.
    const titleLen = (b.title || "x").length;
    const fitFs = (h * 0.72) / (titleLen * 0.6);
    const titleFs = Math.max(8, Math.min(13, Math.round(Math.min(thick * 0.3, fitFs))));
    const authorFs = Math.max(7, Math.min(9, Math.round(thick * 0.21)));
    const hasCover = Boolean(b.coverFile);
    const coverStyle = hasCover ? `background-image:url('${relRoot(2)}${b.coverFile}')` : "";
    // recenter the cover over its slot as it turns face-on
    const presentX = -Math.round(w * 0.34);
    // adapt spine text to the spine's brightness so light covers stay legible
    const c = (b.color || "#33384a").replace("#", "");
    const cr = parseInt(c.slice(0, 2), 16) || 0;
    const cg = parseInt(c.slice(2, 4), 16) || 0;
    const cb = parseInt(c.slice(4, 6), 16) || 0;
    const lum = (0.2126 * cr + 0.7152 * cg + 0.0722 * cb) / 255;
    const sc = lum > 0.58 ? "#23211c" : "#f4f1ea";
    return `
            <button type="button" class="book" style="--h:${h}px;--thick:${thick}px;--w:${w}px;--lean:${lean}deg;--c:${escapeHtml(b.color || "#33384a")};--sc:${sc};--tfs:${titleFs}px;--afs:${authorFs}px;--present-x:${presentX}px" aria-label="${escapeHtml(b.title)} by ${escapeHtml(b.author)}">
              <span class="book-3d">
                <span class="bk-face bk-back"></span>
                <span class="bk-face bk-cover${hasCover ? " has-img" : ""}"${coverStyle ? ` style="${coverStyle}"` : ""}>
                  <span class="c-top"><span class="c-rule"></span><span class="c-title">${escapeHtml(b.title)}</span></span>
                  <span class="c-author">${escapeHtml(b.author)}</span>
                </span>
                <span class="bk-face bk-fore"></span>
                <span class="bk-face bk-top"></span>
                <span class="bk-face bk-bottom"></span>
                <span class="bk-face bk-spine">
                  <span class="s-text">
                    <span class="s-title">${escapeHtml(b.title)}</span>
                    <span class="s-author">${escapeHtml(b.author)}</span>
                  </span>
                </span>
              </span>
            </button>`;
  };

  const shelvesHtml = bookRows.map((row) => `<div class="shelf-row">${row.map(bookEl).join("")}</div>`).join("");

  const aboutBody = `
    ${topbar("../", "about")}
    <main class="wrap page-about">
      <div class="article-head">
        <h1>About</h1>
        <div class="prose">${renderMarkdown(aboutPageRaw)}</div>
      </div>

      <section class="about-section" id="highlights">
        ${renderHighlights(highlights, escapeHtml, {
          imgResolver: (src) => pipeline.rewriteSrc(src, 2),
        })}
      </section>

      <section class="about-section" id="misc">
        <h2 class="section-label">Misc</h2>
        <article class="prose">${renderMarkdown(aboutMiscRaw)}</article>
      </section>

      <section class="about-section" id="bookshelf">
        <h2 class="section-label">Bookshelf</h2>
        <p class="lead" style="margin:0 0 1.5rem;font-size:0.95rem;color:var(--muted)">Books that shaped how I think. Hover or tap a spine to pull it off the shelf.</p>
        <div class="shelves">${shelvesHtml}</div>
      </section>

      <section class="about-section" id="log">
        <button type="button" class="section-toggle" aria-expanded="false" aria-controls="log-panel">
          <span class="caret">›</span>
          <span class="label">Log</span>
        </button>
        <div class="section-panel" id="log-panel" hidden>
          <p class="lead" style="margin:0 0 1.5rem;font-size:0.95rem;color:var(--muted)">A running record of what I'm building, reading, and thinking about.</p>
          <div>${logHtml}</div>
        </div>
      </section>
    </main>`;

  const aboutTitle = `About | ${SITE_TITLE}`;
  const aboutDescription = "About Vedant Misra, an IIT Madras student building AI products, with highlights, books, logs, and notes on product work from India.";
  await writeFile(
    path.join(root, "about", "index.html"),
    shell({
      title: aboutTitle,
      body: aboutBody,
      depth: 2,
      analytics: vercelAnalyticsScript,
      bundles,
      canonicalPath: "/about/",
      description: aboutDescription,
      image: portraitSrc,
      imageAlt: SITE_TITLE,
      structuredData: [
        personSchema(),
        {
          ...webpageSchema({
            type: "ProfilePage",
            path: "/about/",
            title: aboutTitle,
            description: aboutDescription,
            image: portraitSrc,
          }),
          mainEntity: { "@id": PERSON_ID },
        },
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "About", path: "/about/" },
        ]),
      ],
      extraScript: timelineScript() + shelfScript() + aboutToggleScript(),
    })
  );
  sitemapEntries.push({ path: "/about/", lastmod: siteLastmod, images: [portraitSrc] });

  await fs.rm(path.join(root, "log"), { recursive: true, force: true }).catch(() => {});
  await fs.rm(path.join(root, "reading"), { recursive: true, force: true }).catch(() => {});
  for (const oldPath of ["index.html", "about", "writing", "projects", "work", "pers"]) {
    await fs.rm(path.join(root, oldPath), { recursive: true, force: true }).catch(() => {});
  }
  const persSitemapEntries = await buildPersSite({
    rootDir,
    root,
    projects,
    posts,
    aboutHtml: renderMarkdown(aboutPageRaw, 3),
    renderMarkdown,
    siteUrl: SITE_URL,
    basePath: "/",
    outputDir: "",
  });
  await writeSitemap(root, persSitemapEntries);
  await writeRobots(root);
  await writeIndexNowKey(root);

  console.log(`Built site/ (${projects.length} work, ${posts.length} writing, ${logs.length} log entries, ${books.length} books).`);
}
