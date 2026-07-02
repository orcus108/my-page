import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPreviewB as runPreviewB } from "./preview-b.mjs";
import { buildSite as runSite } from "./site.mjs";
import { lightboxStyles, lightboxScript } from "./lightbox.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const contentDir = path.join(rootDir, "content");
const projectsDir = path.join(contentDir, "projects");
const blogDir = path.join(contentDir, "blog");


function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toTitleCase(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n")) {
    return { attrs: {}, body: raw.trim() };
  }

  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new Error("Invalid frontmatter block");
  }

  const block = raw.slice(4, end);
  const body = raw.slice(end + 5).trim();
  const attrs = {};

  for (const line of block.split("\n")) {
    if (!line.trim()) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    attrs[key] = value;
  }

  return { attrs, body };
}

function youtubeVideoId(input) {
  const s = String(input || "").trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = s.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function youtubeEmbedHtml(urlOrId) {
  const id = youtubeVideoId(urlOrId);
  if (!id) return "";
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  return `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(id)}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe></div><p class="video-embed-link"><a href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">watch on youtube</a></p>`;
}

function normalizeImageSrc(src) {
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) {
    return src;
  }
  if (src.startsWith("./")) {
    return `/${src.slice(2)}`;
  }
  if (src.startsWith("images/")) {
    return `/${src}`;
  }
  return src;
}

function externalLinkAttrs(href) {
  if (/^https?:\/\//i.test(String(href).trim())) {
    return ' target="_blank" rel="noopener noreferrer"';
  }
  return "";
}

function inlineMarkdown(text) {
  const tokens = [];
  const stash = (html) => {
    const id = tokens.length;
    tokens.push(html);
    return `\u0000${id}\u0000`;
  };

  const tokenized = String(text)
    .replace(/`([^`]+)`/g, (_m, code) => stash(`<code>${escapeHtml(code)}</code>`))
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
      const normalizedSrc = normalizeImageSrc(src);
      return stash(`<img class="md-image" src="${escapeHtml(normalizedSrc)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`);
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
      return stash(`<a href="${escapeHtml(href)}"${externalLinkAttrs(href)}>${inlineMarkdown(label)}</a>`);
    });

  return escapeHtml(tokenized)
    .replace(/&lt;br\s*\/?&gt;/gi, "<br />")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/\u0000(\d+)\u0000/g, (_m, id) => tokens[Number(id)] ?? "");
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let paragraph = [];
  let list = [];
  let orderedList = [];
  let tableLines = [];
  let blockquote = [];
  let mockupLines = [];
  let inMockups = false;
  let inYoutube = false;
  let youtubeUrl = "";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) out.push(`<p>${inlineMarkdown(text)}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    out.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  const flushOrderedList = () => {
    if (!orderedList.length) return;
    out.push(`<ol>${orderedList.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`);
    orderedList = [];
  };

  const flushBlockquote = () => {
    if (!blockquote.length) return;
    out.push(`<blockquote>${blockquote.map(l => `<p>${inlineMarkdown(l)}</p>`).join("")}</blockquote>`);
    blockquote = [];
  };

  const flushMockups = () => {
    if (!mockupLines.length) return;
    const imgs = mockupLines
      .map((line) => {
        const m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (!m) return "";
        const normalizedSrc = normalizeImageSrc(m[2]);
        return `<img class="md-image" src="${escapeHtml(normalizedSrc)}" alt="${escapeHtml(m[1])}" loading="lazy" decoding="async" />`;
      })
      .filter(Boolean)
      .join("");
    if (imgs) out.push(`<div class="mockup-grid">${imgs}</div>`);
    mockupLines = [];
    inMockups = false;
  };

  const flushYoutube = () => {
    if (!youtubeUrl) {
      inYoutube = false;
      return;
    }
    const embed = youtubeEmbedHtml(youtubeUrl);
    if (embed) out.push(embed);
    youtubeUrl = "";
    inYoutube = false;
  };

  const flushTable = () => {
    if (!tableLines.length) return;
    const [headerLine, , ...bodyLines] = tableLines;
    const headers = headerLine.split("|").map(s => s.trim()).filter(Boolean);
    const headerHtml = headers.map(h => `<th>${inlineMarkdown(h)}</th>`).join("");
    const rowsHtml = bodyLines
      .filter(l => l.trim())
      .map(l => {
        const cells = l.split("|").map(s => s.trim()).filter(Boolean);
        return `<tr>${cells.map(c => `<td>${inlineMarkdown(c)}</td>`).join("")}</tr>`;
      }).join("");
    out.push(`<div class="md-table-wrap"><table class="md-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`);
    tableLines = [];
  };

  for (const lineRaw of lines) {
    const line = lineRaw.trim();

    if (inYoutube) {
      if (line === ":::") {
        flushYoutube();
        continue;
      }
      if (line) youtubeUrl = line;
      continue;
    }

    if (inMockups) {
      if (line === ":::") {
        flushMockups();
        continue;
      }
      if (line) mockupLines.push(line);
      continue;
    }

    if (line === "::: youtube") {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushBlockquote();
      flushTable();
      inYoutube = true;
      youtubeUrl = "";
      continue;
    }

    if (line === "::: mockups") {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushBlockquote();
      flushTable();
      inMockups = true;
      mockupLines = [];
      continue;
    }

    // Table row detection
    if (line.startsWith("|") && line.endsWith("|")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushBlockquote();
      tableLines.push(line);
      continue;
    } else if (tableLines.length) {
      flushTable();
    }

    if (!line) {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushBlockquote();
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      blockquote.push(line.slice(2).trim());
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      flushList();
      flushOrderedList();
      out.push(`<hr class="md-hr" />`);
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      out.push(`<h3>${inlineMarkdown(line.slice(4).trim())}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      out.push(`<h2>${inlineMarkdown(line.slice(3).trim())}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      out.push(`<h1>${inlineMarkdown(line.slice(2).trim())}</h1>`);
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      flushOrderedList();
      list.push(line.slice(2).trim());
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      flushParagraph();
      flushList();
      orderedList.push(line.replace(/^\d+\.\s/, "").trim());
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushOrderedList();
  flushBlockquote();
  flushTable();
  flushMockups();
  flushYoutube();
  return out.join("\n        ");
}

function baseStyles() {
  return `
      :root {
        --bg: #f5f5f0;
        --fg: #1a1a1a;
        --muted: #666;
        --line: #d0d0cc;
        --contrib-1: rgba(5, 150, 105, 0.22);
        --contrib-2: rgba(5, 150, 105, 0.48);
        --contrib-3: rgba(5, 150, 105, 0.72);
        --contrib-4: #059669;
      }

      [data-theme="dark"] {
        --bg: #0d0d0d;
        --fg: #e0e0d8;
        --muted: #888;
        --line: #252520;
        --contrib-1: rgba(110, 231, 183, 0.18);
        --contrib-2: rgba(110, 231, 183, 0.42);
        --contrib-3: rgba(110, 231, 183, 0.68);
        --contrib-4: #6ee7b7;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
        background: var(--bg);
        color: var(--fg);
        line-height: 1.6;
        overflow-x: hidden;
        font-size: 0.875rem;
      }

      main {
        max-width: 680px;
        margin: 0 auto;
        padding: 2rem 1.25rem 3rem;
        position: relative;
        z-index: 1;
      }

      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
      }

      .header-right { display: flex; align-items: center; gap: 0.8rem; line-height: 1; }
      .header-left { display: inline-flex; align-items: center; gap: 0.4rem; line-height: 1; }
      .brand { line-height: 1; font-size: 0.875rem; }
      .brand::before { content: "~/"; color: var(--muted); margin-right: 0.1em; }
      .left-link { line-height: 1; display: inline-flex; align-items: center; }
      .left-sep { color: var(--line); }
      .theme-toggle { display: inline-flex; align-items: center; }
      footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 0.75rem; font-size: 0.78rem; color: var(--muted); }
      .theme-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }

      .theme-slider {
        width: 42px;
        height: 24px;
        border-radius: 2px;
        border: 1px solid var(--line);
        position: relative;
        cursor: pointer;
      }

      .theme-slider::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        border-radius: 1px;
        background: var(--fg);
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .theme-toggle input:checked + .theme-slider::after { transform: translateX(18px); }

      h1, h2 { margin: 0; font-weight: 600; }
      strong { font-weight: 600; }
      h1 { font-size: 0.875rem; }
      .page-title { font-size: 1rem; line-height: 1.35; }
      .page-title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
      .page-links-inline { display: inline-flex; gap: 0.7rem; font-size: 0.8rem; white-space: nowrap; }
      h2 {
        font-size: 0.875rem;
        margin-bottom: 1rem;
        color: var(--muted);
        font-weight: 500;
      }
      h2::before { content: "// "; }
      article h2 { margin-top: 1.8rem; }
      h3 { margin: 0 0 0.5rem; font-size: 0.875rem; }
      p { margin: 0.8rem 0 0; }
      ul { margin: 0; padding: 0; list-style: none; }
      li + li { margin-top: 1.1rem; }
      section { margin-top: 2.5rem; }
      a { color: inherit; text-underline-offset: 0.15em; }
      .list-link { text-decoration: none; font-weight: 500; }
      .muted { color: var(--muted); }
      .list-item { display: block; }
      .list-item-link { display: block; text-decoration: none; }
      .list-item-link:hover .list-title { text-decoration: underline; text-underline-offset: 0.15em; }
      .list-title { display: inline-block; line-height: 1.3; }
      .list-meta { margin-top: 0.2rem; font-size: 0.8rem; color: var(--muted); }
      .post-meta { font-size: 0.78rem; }

      .section-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 1rem; }
      .section-header h2 { margin-bottom: 0; }
      .view-all { font-size: 0.78rem; color: var(--muted); text-decoration: none; white-space: nowrap; line-height: 1; }
      .view-all:hover { color: var(--fg); }
      .nav-link { font-size: 0.78rem; color: var(--muted); text-decoration: none; line-height: 1; }
      .nav-link:hover { color: var(--fg); }

      article ul { list-style: disc; padding-left: 1.1rem; }
      article ol { list-style: decimal; padding-left: 1.1rem; }
      article li + li { margin-top: 0.45rem; }
      .md-image { display: block; max-width: 100%; height: auto; margin-top: 0.9rem; border-radius: 2px; }
      .mockup-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
        margin-top: 0.9rem;
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
      p:has(> .md-image + .md-image) { display: flex; gap: 1.5rem; align-items: flex-start; margin-top: 0.9rem; }
      p:has(> .md-image + .md-image) .md-image { flex: 1; min-width: 0; margin-top: 0; }
      .md-hr { border: 0; border-top: 1px solid var(--line); margin: 1.2rem 0; }
      blockquote { margin: 1.5rem 0 0; padding-left: 1rem; border-left: 2px solid var(--line); }
      blockquote p { margin: 0; color: var(--muted); line-height: 1.6; }
      .stack-chip {
        display: inline-block;
        padding: 0.15rem 0.4rem;
        border-radius: 2px;
        font-size: 0.72rem;
        border: 1px solid var(--line);
        color: var(--muted);
      }

      .md-table-wrap { overflow-x: auto; margin-top: 0.9rem; }
      .md-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
      .md-table th, .md-table td { padding: 0.45rem 0.75rem; border: 1px solid var(--line); text-align: left; }
      .md-table th { font-weight: 600; color: var(--muted); background: transparent; }

      .contrib-chart { overflow-x: auto; padding-bottom: 0.25rem; }
      .contrib-grid { display: grid; grid-template-rows: repeat(7, 10px); gap: 2px; width: fit-content; }
      .contrib-cell { width: 10px; height: 10px; border-radius: 2px; background: rgba(0, 0, 0, 0.07); transition: transform 0.1s ease; }
      [data-theme="dark"] .contrib-cell { background: rgba(255, 255, 255, 0.05); }
      .contrib-cell[data-level="1"] { background: var(--contrib-1); }
      .contrib-cell[data-level="2"] { background: var(--contrib-2); }
      .contrib-cell[data-level="3"] { background: var(--contrib-3); }
      .contrib-cell[data-level="4"] { background: var(--contrib-4); }
      .contrib-cell:hover { transform: scale(1.35); }

      body { transition: background-color 0.25s ease, color 0.25s ease; }

      a { transition: color 0.15s ease; }
      footer a:hover { color: var(--fg); }

      .log-day { margin-bottom: 2rem; }
      .log-day:last-child { margin-bottom: 0; }
      .log-day-label { font-size: 0.78rem; color: var(--fg); font-weight: 500; margin-bottom: 0.65rem; }
      .log-entry { margin-bottom: 0.9rem; }
      .log-entry:last-child { margin-bottom: 0; }
      .log-time { font-size: 0.72rem; color: var(--muted); margin-bottom: 0.2rem; font-variant-numeric: tabular-nums; }
      .log-body p { margin: 0; }
      .log-body p + p { margin-top: 0.5rem; }

      .list-item-link { transition: transform 0.15s ease; }
      .list-item-link:hover { transform: translateX(4px); }

@media (max-width: 640px) {
        main {
          padding: 1.1rem 1rem 2.2rem;
        }

        h1 {
          font-size: 0.82rem;
        }

        .page-title {
          font-size: 0.92rem;
        }

        .page-title-row {
          flex-wrap: wrap;
          align-items: flex-start;
          gap: 0.45rem 0.8rem;
        }

        .page-links-inline {
          font-size: 0.76rem;
          gap: 0.6rem;
        }

        header {
          gap: 0.75rem;
        }

        .header-right {
          gap: 0.55rem;
          white-space: nowrap;
        }

        .theme-slider {
          width: 38px;
          height: 22px;
        }

        .theme-slider::after {
          width: 16px;
          height: 16px;
        }

        .theme-toggle input:checked + .theme-slider::after {
          transform: translateX(16px);
        }

        section {
          margin-top: 2rem;
        }

        li + li {
          margin-top: 0.95rem;
        }

        .list-meta {
          font-size: 0.78rem;
        }

        .post-meta {
          font-size: 0.75rem;
        }
      }
${lightboxStyles}
  `;
}

function themeScript() {
  return `
    <script>
      const root = document.documentElement;
      const btn = document.getElementById("theme-toggle");
      const stored = localStorage.getItem("theme");
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initialTheme = stored || (systemDark ? "dark" : "light");

      function applyTheme(theme) {
        root.setAttribute("data-theme", theme);
        btn.checked = theme === "dark";
      }

      applyTheme(initialTheme);

      btn.addEventListener("change", () => {
        const next = btn.checked ? "dark" : "light";
        localStorage.setItem("theme", next);
        applyTheme(next);
      });
    </script>
  `;
}

function easterEggScript() {
  return `
    <script>
      console.log('%c// hey, nosy. i see you.', 'font-family:monospace;font-size:13px;color:#a78bfa;');
      console.log('%c   x (twitter) → https://x.com/orcus108', 'font-family:monospace;font-size:11px;color:#888;');
      console.log('%c   github      → https://github.com/orcus108', 'font-family:monospace;font-size:11px;color:#888;');

      (function() {
        const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
        let idx = 0;
        document.addEventListener('keydown', function(e) {
          if (e.key === code[idx]) {
            idx++;
            if (idx === code.length) { idx = 0; matrixRain(); }
          } else {
            idx = e.key === code[0] ? 1 : 0;
          }
        });

        function matrixRain() {
          const canvas = document.createElement('canvas');
          canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.4s;';
          document.body.appendChild(canvas);
          const ctx = canvas.getContext('2d');
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          requestAnimationFrame(function() { canvas.style.opacity = '1'; });

          const cols = Math.floor(canvas.width / 16);
          const drops = Array.from({length: cols}, function() { return Math.random() * -50; });
          const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF';

          const interval = setInterval(function() {
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px monospace';
            drops.forEach(function(y, i) {
              const bright = Math.random() > 0.95;
              ctx.fillStyle = bright ? '#ffffff' : '#6ee7b7';
              ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * 16, y * 16);
              if (y * 16 > canvas.height && Math.random() > 0.97) drops[i] = 0;
              drops[i]++;
            });
          }, 45);

          setTimeout(function() {
            clearInterval(interval);
            canvas.style.opacity = '0';
            setTimeout(function() { canvas.remove(); }, 400);
          }, 4000);
        }
      })();
    </script>
  `;
}

function vercelAnalyticsScript() {
  return `
    <script defer src="/_vercel/insights/script.js"></script>
  `;
}

async function fetchGithubContributions(username, token) {
  const query = `query($u:String!,$from:DateTime!,$to:DateTime!){user(login:$u){contributionsCollection(from:$from,to:$to){contributionCalendar{totalContributions weeks{contributionDays{contributionCount date}}}}}}`;
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { u: username, from: "2026-01-01T00:00:00Z", to: "2026-12-31T23:59:59Z" } }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.user?.contributionsCollection?.contributionCalendar ?? null;
  } catch {
    return null;
  }
}

function contribLevel(count) {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 9) return 2;
  if (count <= 19) return 3;
  return 4;
}

function renderContribChart(calendar) {
  const { totalContributions, weeks } = calendar;
  const cells = weeks.flatMap((week, wi) =>
    week.contributionDays.map((day) => {
      const [y, m, d] = day.date.split("-").map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const level = contribLevel(day.contributionCount);
      return `<div class="contrib-cell" data-level="${level}" style="grid-column:${wi + 1};grid-row:${dow + 1}" title="${day.date}: ${day.contributionCount}"></div>`;
    })
  ).join("");

  return `
      <section>
        <h2>activity</h2>
        <p class="muted" style="font-size:0.78rem;margin-top:0;">${totalContributions} contributions in 2026</p>
        <div class="contrib-chart">
          <div class="contrib-grid" style="grid-template-columns:repeat(${weeks.length},10px);">${cells}</div>
        </div>
      </section>`;
}

function header(leftHref, leftText, secondHref, secondText, navLinks = []) {
  const leftNode = leftHref
    ? `<a class="left-link" href="${leftHref}">${leftText}</a>`
    : `<h1 class="brand">${leftText}</h1>`;

  const secondNode = secondHref
    ? `<a class="left-link second-link" href="${secondHref}">${secondText}</a>`
    : "";

  const navHtml = navLinks.map(l => `<a class="nav-link" href="${escapeHtml(l.href)}">${escapeHtml(l.text)}</a>`).join("");

  return `
      <header>
        <div class="header-left">${leftNode}${secondNode ? `<span class="left-sep">/</span>${secondNode}` : ""}</div>
        <div class="header-right">
          ${navHtml}
          <label class="theme-toggle" aria-label="Toggle theme">
            <input id="theme-toggle" type="checkbox" />
            <span class="theme-slider"></span>
          </label>
        </div>
      </header>
  `;
}

function shell(title, body, extraHead = "") {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
${extraHead}
    <style>
${baseStyles()}
    </style>
  </head>
  <body>
    <main>
${body}
      <footer>
        <a href="https://x.com/orcus108" target="_blank" rel="noopener noreferrer">X (Twitter)</a>
        <a href="https://github.com/orcus108" target="_blank" rel="noopener noreferrer">GitHub</a>
      </footer>
    </main>
${vercelAnalyticsScript()}
${easterEggScript()}
${themeScript()}
${lightboxScript()}
  </body>
</html>
`;
}

async function loadCollection(dir, type) {
  const names = (await fs.readdir(dir)).filter((name) => name.endsWith(".md"));
  const items = [];

  for (const name of names) {
    const fullPath = path.join(dir, name);
    const raw = await fs.readFile(fullPath, "utf8");
    const { attrs, body } = parseFrontmatter(raw);

    const fallbackSlug = name.replace(/\.md$/, "");
    const slug = attrs.slug || fallbackSlug;
    const title = attrs.title || toTitleCase(slug);
    const date = attrs.date || "";

    items.push({
      type,
      slug,
      title,
      summary: attrs.summary || "",
      readTime: attrs.read_time || "",
      stack: attrs.stack || "",
      status: attrs.status || "",
      repo: attrs.repo || "",
      demo: attrs.demo || "",
      featured: attrs.featured === "true",
      order: attrs.order ? parseInt(attrs.order, 10) : null,
      image: attrs.image || "",
      banner: attrs.banner || "",
      date,
      body,
      htmlBody: markdownToHtml(body)
    });
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function formatDate(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return dateInput;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatMonthYear(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return dateInput;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(filePath, content) {
  await fs.writeFile(filePath, content, "utf8");
}

function highlightsStyles() {
  return `
    <style>
      .tl-wrap {
        position: relative;
        margin-top: 2rem;
        padding-bottom: 1rem;
      }

      .tl-wrap::before {
        content: '';
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
      }

      .tl-wrap.tl-active::before {
        transform: scaleY(1);
      }

      .tl-entry {
        display: flex;
        align-items: center;
        margin-bottom: 2rem;
        opacity: 0;
        transform: translateX(-10px);
        transition: opacity 0.48s cubic-bezier(0.16, 1, 0.3, 1) calc(var(--i) * 0.13s),
                    transform 0.48s cubic-bezier(0.16, 1, 0.3, 1) calc(var(--i) * 0.13s);
      }

      .tl-entry:last-child { margin-bottom: 0; }

      .tl-entry.tl-visible {
        opacity: 1;
        transform: none;
      }

      .tl-img {
        width: 64px;
        height: 64px;
        flex: 0 0 64px;
        border-radius: 4px;
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

      .tl-img-placeholder {
        width: 100%;
        height: 100%;
        background: var(--line);
      }

      .tl-connector {
        width: 28px;
        flex: 0 0 28px;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        z-index: 1;
        align-self: stretch;
      }

      .tl-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--fg);
        flex-shrink: 0;
        transition: transform 0.2s ease;
      }

      .tl-entry:hover .tl-dot { transform: scale(1.55); }

      .tl-body {
        flex: 1;
        padding-left: 0.85rem;
      }

      .tl-date {
        font-size: 0.72rem;
        color: var(--muted);
        margin-bottom: 0.18rem;
        line-height: 1.4;
      }

      .tl-text {
        font-size: 0.875rem;
        line-height: 1.5;
      }

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

      .tl-body:hover .tl-note {
        max-height: 50vh;
        opacity: 1;
        margin-top: 0.45rem;
        transform: translateY(0);
      }

      @keyframes tl-hint {
        0%, 55%, 100% { opacity: 0; }
        20%, 38% { opacity: 1; }
      }

      .tl-hint {
        font-size: 0.65rem;
        color: var(--muted);
        opacity: 0;
        pointer-events: none;
        animation: tl-hint 9s ease-in-out infinite;
        animation-delay: 2.5s;
        line-height: 1;
      }

      @media (max-width: 480px) {
        .tl-wrap::before { left: 58px; }
        .tl-img { width: 48px; height: 48px; flex: 0 0 48px; }
        .tl-connector { width: 20px; flex: 0 0 20px; }
        .tl-text { font-size: 0.82rem; }
      }

      .tl-entry.tl-tapped .tl-note {
        max-height: 50vh;
        opacity: 1;
        margin-top: 0.45rem;
        transform: translateY(0);
      }
    </style>
  `;
}

function highlightsScript() {
  return `
    <script>
      (function() {
        var wrap = document.querySelector('.tl-wrap');
        var entries = document.querySelectorAll('.tl-entry');

        var lineObserver = new IntersectionObserver(function(observed) {
          observed.forEach(function(entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('tl-active');
              lineObserver.unobserve(entry.target);
            }
          });
        }, { threshold: 0.05 });
        if (wrap) lineObserver.observe(wrap);

        var entryObserver = new IntersectionObserver(function(observed) {
          observed.forEach(function(entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('tl-visible');
              entryObserver.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15 });
        entries.forEach(function(el) { entryObserver.observe(el); });

        var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        var hint = document.querySelector('.tl-hint');
        if (hint && isTouch) hint.textContent = 'tap image to reveal notes';

        if (isTouch) {
          document.querySelectorAll('.tl-img').forEach(function(img) {
            var entry = img.closest('.tl-entry');
            img.style.cursor = 'pointer';
            img.style.touchAction = 'manipulation';
            var fired = false;
            img.addEventListener('touchend', function(e) {
              e.preventDefault();
              fired = true;
              var isOpen = entry.classList.contains('tl-tapped');
              document.querySelectorAll('.tl-entry.tl-tapped').forEach(function(el) {
                el.classList.remove('tl-tapped');
              });
              if (!isOpen) entry.classList.add('tl-tapped');
            });
            img.addEventListener('click', function() {
              if (fired) { fired = false; return; }
              var isOpen = entry.classList.contains('tl-tapped');
              document.querySelectorAll('.tl-entry.tl-tapped').forEach(function(el) {
                el.classList.remove('tl-tapped');
              });
              if (!isOpen) entry.classList.add('tl-tapped');
            });
          });
        }
      })();
    </script>
  `;
}

async function buildAboutPage() {
  const raw = await fs.readFile(path.join(contentDir, "about.md"), "utf8");
  const highlights = JSON.parse(
    await fs.readFile(path.join(contentDir, "highlights.json"), "utf8")
  );

  const entries = highlights.map((h, i) => {
    const imgHtml = h.img
      ? `<img src="${escapeHtml(`/images/highlights/${h.img}`)}" alt="" loading="lazy" />`
      : `<div class="tl-img-placeholder"></div>`;
    return `
        <div class="tl-entry" style="--i:${i}">
          <div class="tl-img">${imgHtml}</div>
          <div class="tl-connector"><div class="tl-dot"></div></div>
          <div class="tl-body">
            <div class="tl-date">${escapeHtml(h.date)}</div>
            <div class="tl-text">${escapeHtml(h.text)}</div>
            ${h.note ? `<div class="tl-note">${escapeHtml(h.note)}</div>` : ""}
          </div>
        </div>`;
  }).join("");

  const body = `
${header("../index.html", "home")}

      <section>
        <article>
          ${markdownToHtml(raw)}
        </article>
      </section>

      <section>
        <div class="section-header">
          <h2>highlights</h2>
          <span class="tl-hint">hover events for notes</span>
        </div>
        <div class="tl-wrap">
          ${entries}
        </div>
      </section>
      ${highlightsScript()}
  `;

  await ensureDir(path.join(rootDir, "about"));
  await writeFile(
    path.join(rootDir, "about", "index.html"),
    shell("About - Vedant Misra", body, highlightsStyles())
  );
}

async function loadLogs() {
  const logsFile = path.join(contentDir, "logs.md");
  try {
    const raw = await fs.readFile(logsFile, "utf8");
    const sections = raw.split(/^## /m).filter(s => s.trim());
    return sections.map(section => {
      const newlineIdx = section.indexOf("\n");
      if (newlineIdx === -1) return null;
      const timestamp = section.slice(0, newlineIdx).trim();
      const body = section.slice(newlineIdx + 1).trim();
      return timestamp && body ? { timestamp, body } : null;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function buildLogsPage(logs) {
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

  const daysHtml = days.length
    ? days.map(day => `
      <div class="log-day">
        <div class="log-day-label">${escapeHtml(day.date)}</div>
        ${day.entries.map(e => `<div class="log-entry">
          <div class="log-time">${escapeHtml(e.time)}</div>
          <div class="log-body">${markdownToHtml(e.body)}</div>
        </div>`).join("")}
      </div>`).join("")
    : `<p class="muted">no logs yet.</p>`;

  const body = `
${header("../index.html", "home")}

      <section>
        <h2>logs</h2>
        <div style="margin-top:1.25rem;">
          ${daysHtml}
        </div>
      </section>
  `;

  await ensureDir(path.join(rootDir, "logs"));
  await writeFile(path.join(rootDir, "logs", "index.html"), shell("Logs - Vedant Misra", body));
}

async function build() {
  const projects = await loadCollection(projectsDir, "project");
  const posts = await loadCollection(blogDir, "blog");
  const logs = await loadLogs();

  await ensureDir(path.join(rootDir, "projects"));
  await ensureDir(path.join(rootDir, "blog"));

  const featuredProjects = projects
    .filter((p) => p.featured)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  const homeProjects = featuredProjects.length > 0 ? featuredProjects : projects.slice(0, 3);
  const homePosts = posts.slice(0, 3);

  // const token = process.env.GITHUB_TOKEN;
  // let contribHtml = "";
  // if (token) {
  //   const calendar = await fetchGithubContributions("orcus108", token);
  //   if (calendar) contribHtml = renderContribChart(calendar);
  // }
  const contribHtml = "";

  const homeBody = `
${header("", "Vedant Misra", null, null, [{ href: "about/index.html", text: "about" }, { href: "logs/index.html", text: "logs" }])}

      <section>
        <p class="muted">iit madras. ai and what to build with it.</p>
      </section>

      <section>
        <div class="section-header">
          <h2>projects</h2>
          <a class="view-all" href="projects/index.html">view all →</a>
        </div>
        <ul>
          ${homeProjects
            .map(
              (p) =>
                `<li class="list-item"><a class="list-item-link" href="projects/${p.slug}.html"><span class="list-link list-title">${escapeHtml(p.title.toLowerCase())}</span><div class="list-meta">${escapeHtml(p.summary.toLowerCase())}</div></a></li>`
            )
            .join("\n          ")}
        </ul>
      </section>

      <section>
        <div class="section-header">
          <h2>blog</h2>
          <a class="view-all" href="blog/index.html">view all →</a>
        </div>
        <ul>
          ${homePosts
            .map(
              (p) =>
                `<li class="list-item"><a class="list-item-link" href="blog/${p.slug}.html"><span class="list-link list-title">${escapeHtml(p.title.toLowerCase())}</span><div class="list-meta">${escapeHtml(p.summary)}</div></a></li>`
            )
            .join("\n          ")}
        </ul>
      </section>

      <section>
        <h2>currently reading</h2>
        <ul>
          <li class="list-item"><span class="list-title">high output management</span><span class="list-meta" style="display:inline;margin-left:0.4rem;">· andy grove</span></li>
        </ul>
      </section>

      ${contribHtml}
  `;

  const prefetchHead = [
    `    <link rel="prefetch" href="projects/index.html" />`,
    `    <link rel="prefetch" href="blog/index.html" />`,
    ...homeProjects.map((p) => `    <link rel="prefetch" href="projects/${p.slug}.html" />`),
    ...homePosts.map((p) => `    <link rel="prefetch" href="blog/${p.slug}.html" />`)
  ].join("\n");

  await writeFile(path.join(rootDir, "index.html"), shell("Vedant Misra", homeBody, prefetchHead));

  for (const project of projects) {
    const projectBody = `
${header("../index.html", "home", "index.html", "projects")}

      <section>
        <div class="page-title-row">
          <h1 class="page-title">${escapeHtml(project.title.toLowerCase())}</h1>
          ${project.repo || project.demo
            ? `<nav class="page-links-inline" aria-label="Project links">
            ${project.repo ? `<a href="${escapeHtml(project.repo)}" target="_blank" rel="noopener noreferrer">repo</a>` : ""}
            ${project.demo ? `<a href="${escapeHtml(project.demo)}" target="_blank" rel="noopener noreferrer">demo</a>` : ""}
          </nav>`
            : ""}
        </div>
        <p class="muted">${escapeHtml(project.summary.toLowerCase())}</p>
        ${project.date ? `<div style="margin-top:0.6rem;"><span class="muted" style="font-size:0.72rem;">${formatMonthYear(project.date)}</span></div>` : ""}
      </section>

      <section>
        <h2>overview</h2>
        <article>
        ${project.htmlBody}
        </article>
      </section>

      ${project.stack
        ? `<section>
        <h2>stack</h2>
        <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.2rem;">
          ${project.stack.split(",").map(s => `<span class="stack-chip">${escapeHtml(s.trim())}</span>`).join("")}
        </div>
      </section>`
        : ""}

    `;

    await writeFile(path.join(rootDir, "projects", `${project.slug}.html`), shell(`${project.title} - Vedant Misra`, projectBody));
  }

  for (const post of posts) {
    const postMeta = [formatDate(post.date), post.readTime].filter(Boolean).join(" · ");
    const postBody = `
${header("../index.html", "home", "index.html", "blog")}

      <section>
        <h1 class="page-title">${escapeHtml(post.title.toLowerCase())}</h1>
        ${post.summary ? `<p class="muted">${escapeHtml(post.summary)}</p>` : ""}
        <p class="muted post-meta">${escapeHtml(postMeta)}</p>
      </section>

      <section>
        <article>
        ${post.htmlBody}
        </article>
      </section>
    `;

    await writeFile(path.join(rootDir, "blog", `${post.slug}.html`), shell(`${post.title} - Vedant Misra`, postBody));
  }

  const allProjectsBody = `
${header("../index.html", "home")}

      <section>
        <h2>all projects</h2>
        <ul>
          ${projects
            .map(
              (p) =>
                `<li class="list-item"><a class="list-item-link" href="${p.slug}.html"><span class="list-link list-title">${escapeHtml(p.title.toLowerCase())}</span><div class="list-meta">${escapeHtml(p.summary.toLowerCase())}</div></a></li>`
            )
            .join("\n          ")}
        </ul>
      </section>
  `;

  await writeFile(path.join(rootDir, "projects", "index.html"), shell("Projects - Vedant Misra", allProjectsBody));

  const allPostsBody = `
${header("../index.html", "home")}

      <section>
        <h2>all posts</h2>
        <ul>
          ${posts
            .map(
              (p) =>
                `<li class="list-item"><a class="list-item-link" href="${p.slug}.html"><span class="list-link list-title">${escapeHtml(p.title.toLowerCase())}</span><div class="list-meta">${escapeHtml(p.summary)}${p.readTime ? ` · ${escapeHtml(p.readTime)}` : ""}</div></a></li>`
            )
            .join("\n          ")}
        </ul>
      </section>
  `;

  await writeFile(path.join(rootDir, "blog", "index.html"), shell("Blog - Vedant Misra", allPostsBody));

  await fs.rm(path.join(rootDir, "highlights"), { recursive: true, force: true });
  await buildAboutPage();
  await buildLogsPage(logs);

  console.log(`Built ${projects.length} projects, ${posts.length} blog posts, and about page.`);
}

async function buildPreviewB() {
  await runPreviewB({
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
  });
}

async function buildSite() {
  await runSite({
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
  });
}

const mode = process.argv[2];
if (mode === "preview-b") {
  buildPreviewB().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
} else if (mode === "site") {
  buildSite().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
} else {
  build().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
