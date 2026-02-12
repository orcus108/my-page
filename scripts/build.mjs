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

function inlineMarkdown(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  });
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let paragraph = [];
  let list = [];

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

  for (const lineRaw of lines) {
    const line = lineRaw.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      out.push(`<h3>${inlineMarkdown(line.slice(4).trim())}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      out.push(`<h2>${inlineMarkdown(line.slice(3).trim())}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      out.push(`<h1>${inlineMarkdown(line.slice(2).trim())}</h1>`);
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2).trim());
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return out.join("\n        ");
}

function baseStyles() {
  return `
      :root {
        --bg: #f7f7f7;
        --fg: #111;
        --muted: #666;
        --line: #ddd;
      }

      [data-theme="dark"] {
        --bg: #0f0f10;
        --fg: #efefef;
        --muted: #9a9a9a;
        --line: #2a2a2c;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
        background: var(--bg);
        color: var(--fg);
        line-height: 1.65;
        overflow-x: hidden;
      }

      main {
        max-width: 700px;
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
      .brand { line-height: 1; }
      .left-link { line-height: 1; display: inline-flex; align-items: center; }
      .socials { display: inline-flex; align-items: center; gap: 0.55rem; font-size: 0.92rem; line-height: 1; }
      .theme-toggle { display: inline-flex; align-items: center; }
      .theme-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }

      .theme-slider {
        width: 42px;
        height: 24px;
        border-radius: 999px;
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
        border-radius: 50%;
        background: var(--fg);
        transition: transform 0.2s ease;
      }

      .theme-toggle input:checked + .theme-slider::after { transform: translateX(18px); }

      h1, h2 { margin: 0; font-weight: 600; }
      h1 { font-size: 1.2rem; }
      h2 {
        font-size: 0.78rem;
        margin-bottom: 1rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
        font-weight: 600;
      }
      h3 { margin: 0 0 0.5rem; font-size: 0.98rem; }
      p { margin: 0.8rem 0 0; }
      ul { margin: 0; padding: 0; list-style: none; }
      li + li { margin-top: 1.1rem; }
      section { margin-top: 2.5rem; }
      a { color: inherit; text-underline-offset: 0.15em; }
      .list-link { text-decoration: none; font-weight: 500; }
      .muted { color: var(--muted); }
      .list-item { display: block; }
      .list-title { display: inline-block; line-height: 1.25; }
      .list-meta { margin-top: 0.2rem; font-size: 0.92rem; color: var(--muted); }

      article ul { list-style: disc; padding-left: 1.1rem; }
      article li + li { margin-top: 0.45rem; }

      @media (max-width: 640px) {
        main {
          padding: 1.1rem 1rem 2.2rem;
        }

        h1 {
          font-size: 1.1rem;
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
          font-size: 0.88rem;
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
          font-size: 0.88rem;
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

function header(leftHref, leftText) {
  const leftNode = leftHref
    ? `<a class="left-link" href="${leftHref}">${leftText}</a>`
    : `<h1 class="brand">${leftText}</h1>`;

  return `
      <header>
        ${leftNode}
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

  const homeBody = `
${header("", "Vedant Misra")}

      <section>
        <p class="muted">thinking out loud</p>
      </section>

      <section>
        <h2>projects</h2>
        <ul>
          ${projects
            .map(
              (p) =>
                `<li class="list-item"><a class="list-link list-title" href="projects/${p.slug}.html">${escapeHtml(p.title.toLowerCase())}</a><div class="list-meta">${escapeHtml(p.summary.toLowerCase())}</div></li>`
            )
            .join("\n          ")}
        </ul>
      </section>

      <section>
        <h2>blog</h2>
        <ul>
          ${posts
            .map(
              (p) =>
                `<li class="list-item"><a class="list-link list-title" href="blog/${p.slug}.html">${escapeHtml(p.title.toLowerCase())}</a><div class="list-meta">${escapeHtml(formatDate(p.date))}</div></li>`
            )
            .join("\n          ")}
        </ul>
      </section>
  `;

  const prefetchHead = [
    ...projects.map((p) => `    <link rel="prefetch" href="projects/${p.slug}.html" />`),
    ...posts.map((p) => `    <link rel="prefetch" href="blog/${p.slug}.html" />`)
  ].join("\n");

  await writeFile(path.join(rootDir, "index.html"), shell("Vedant Misra", homeBody, prefetchHead));

  for (const project of projects) {
    const projectBody = `
${header("../index.html", "home")}

      <section>
        <h1>${escapeHtml(project.title.toLowerCase())}</h1>
        <p class="muted">${escapeHtml(project.summary.toLowerCase())}</p>
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
        <p>${escapeHtml(project.stack)}</p>
      </section>`
        : ""}
    `;

    await writeFile(path.join(rootDir, "projects", `${project.slug}.html`), shell(`${project.title} - Vedant Misra`, projectBody));
  }

  for (const post of posts) {
    const postMeta = [formatDate(post.date), post.readTime].filter(Boolean).join(" · ");
    const postBody = `
${header("../index.html", "home")}

      <section>
        <h1>${escapeHtml(post.title.toLowerCase())}</h1>
        <p class="muted">${escapeHtml(postMeta)}</p>
      </section>

      <section>
        <article>
        ${post.htmlBody}
        </article>
      </section>
    `;

    await writeFile(path.join(rootDir, "blog", `${post.slug}.html`), shell(`${post.title} - Vedant Misra`, postBody));
  }

  console.log(`Built ${projects.length} projects and ${posts.length} blog posts.`);
}

build().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
