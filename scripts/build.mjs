import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function inlineMarkdown(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/&lt;br\s*\/?&gt;/gi, "<br />")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
      const normalizedSrc = normalizeImageSrc(src);
      return `<img class="md-image" src="${escapeHtml(normalizedSrc)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
      return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let paragraph = [];
  let list = [];
  let orderedList = [];
  let tableLines = [];

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

    // Table row detection
    if (line.startsWith("|") && line.endsWith("|")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      tableLines.push(line);
      continue;
    } else if (tableLines.length) {
      flushTable();
    }

    if (!line) {
      flushParagraph();
      flushList();
      flushOrderedList();
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
  flushTable();
  return out.join("\n        ");
}

function baseStyles() {
  return `
      :root {
        --bg: #f5f5f0;
        --fg: #1a1a1a;
        --muted: #666;
        --line: #d0d0cc;
      }

      [data-theme="dark"] {
        --bg: #0d0d0d;
        --fg: #e0e0d8;
        --muted: #888;
        --line: #252520;
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
      .socials { display: inline-flex; align-items: center; gap: 0.55rem; font-size: 0.8rem; line-height: 1; }
      .theme-toggle { display: inline-flex; align-items: center; }
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
        transition: transform 0.2s ease;
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

      article ul { list-style: disc; padding-left: 1.1rem; }
      article ol { list-style: decimal; padding-left: 1.1rem; }
      article li + li { margin-top: 0.45rem; }
      .md-image { display: block; max-width: 100%; height: auto; margin-top: 0.9rem; border-radius: 2px; }
      p:has(> .md-image + .md-image) { display: flex; gap: 1.5rem; align-items: flex-start; margin-top: 0.9rem; }
      p:has(> .md-image + .md-image) .md-image { flex: 1; min-width: 0; margin-top: 0; }
      .md-hr { border: 0; border-top: 1px solid var(--line); margin: 1.2rem 0; }
      .status-chip {
        display: inline-block;
        padding: 0.15rem 0.4rem;
        border-radius: 2px;
        font-size: 0.72rem;
        border: 1px solid var(--line);
        color: var(--muted);
        position: relative;
        cursor: default;
      }
      .stack-chip {
        display: inline-block;
        padding: 0.15rem 0.4rem;
        border-radius: 2px;
        font-size: 0.72rem;
        border: 1px solid var(--line);
        color: var(--muted);
      }
      .status-chip.status-in-progress { border-color: #7c3aed; color: #7c3aed; }
      .status-chip.status-shipped { border-color: #059669; color: #059669; }
      .status-chip.status-archived { border-color: var(--line); color: var(--muted); }
      [data-theme="dark"] .status-chip.status-in-progress { border-color: #a78bfa; color: #a78bfa; }
      [data-theme="dark"] .status-chip.status-shipped { border-color: #6ee7b7; color: #6ee7b7; }
      .status-chip[data-tooltip]::after {
        content: attr(data-tooltip);
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: var(--fg);
        color: var(--bg);
        font-size: 0.7rem;
        white-space: nowrap;
        padding: 0.2rem 0.45rem;
        border-radius: 2px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s ease;
      }
      .status-chip[data-tooltip]:hover::after { opacity: 1; }

      .md-table-wrap { overflow-x: auto; margin-top: 0.9rem; }
      .md-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
      .md-table th, .md-table td { padding: 0.45rem 0.75rem; border: 1px solid var(--line); text-align: left; }
      .md-table th { font-weight: 600; color: var(--muted); background: transparent; }

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

        .socials {
          gap: 0.75rem;
          font-size: 0.78rem;
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

function vercelAnalyticsScript() {
  return `
    <script defer src="/_vercel/insights/script.js"></script>
  `;
}

function header(leftHref, leftText, secondHref, secondText) {
  const leftNode = leftHref
    ? `<a class="left-link" href="${leftHref}">${leftText}</a>`
    : `<h1 class="brand">${leftText}</h1>`;

  const secondNode = secondHref
    ? `<a class="left-link second-link" href="${secondHref}">${secondText}</a>`
    : "";

  return `
      <header>
        <div class="header-left">${leftNode}${secondNode ? `<span class="left-sep">/</span>${secondNode}` : ""}</div>
        <div class="header-right">
          <nav class="socials" aria-label="Social links">
            <a href="https://x.com/orcus108" aria-label="X profile" target="_blank" rel="noopener noreferrer">X (Twitter)</a>
            <a href="https://github.com/orcus108" aria-label="GitHub profile" target="_blank" rel="noopener noreferrer">GitHub</a>
          </nav>
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
    </main>
${vercelAnalyticsScript()}
${themeScript()}
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

async function build() {
  const projects = await loadCollection(projectsDir, "project");
  const posts = await loadCollection(blogDir, "blog");

  await ensureDir(path.join(rootDir, "projects"));
  await ensureDir(path.join(rootDir, "blog"));

  const featuredProjects = projects
    .filter((p) => p.featured)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  const homeProjects = featuredProjects.length > 0 ? featuredProjects : projects.slice(0, 3);
  const homePosts = posts.slice(0, 3);

  const homeBody = `
${header("", "Vedant Misra")}

      <section>
        <p class="muted">iit madras. ai, products, and the gap between the two.</p>
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
          <li class="list-item"><span class="list-title">apple in china</span><span class="list-meta" style="display:inline;margin-left:0.4rem;">· patrick mcgee</span></li>
        </ul>
      </section>
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
        <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;margin-top:0.6rem;">
          ${project.status ? `<span class="status-chip status-${project.status.toLowerCase().replace(/\s+/g, "-")}" data-tooltip="${{ shipped: "live and done", "in-progress": "currently being built", archived: "put on hold" }[project.status.toLowerCase().replace(/\s+/g, "-")] || ""}">${escapeHtml(project.status.toLowerCase())}</span>` : ""}
          ${project.date ? `<span class="muted" style="font-size:0.72rem;">${formatMonthYear(project.date)}</span>` : ""}
        </div>
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

  console.log(`Built ${projects.length} projects and ${posts.length} blog posts.`);
}

build().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
