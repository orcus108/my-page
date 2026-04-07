# Site Guide

## Add a project

Create `content/projects/<slug>.md`:

```markdown
---
title: My Project
slug: my-project
summary: one-line description
date: 2026-04-08
status: In progress
featured: true
repo: https://github.com/you/repo
demo: https://yoursite.com
---

Your content here. Supports **bold**, *italic*, `lists`, images, and links.
```

- `featured: true` → shows on homepage. Omit (or set `false`) to hide from homepage (still on `/projects/index.html`).
- `order: 1` → controls homepage position among featured projects. Lower = higher up. Projects without `order` fall to the end.
- `repo` and `demo` are optional.

---

## Add a blog post

Create `content/blog/<slug>.md`:

```markdown
---
title: My Post
slug: my-post
date: 2026-04-08
read_time: 4 min read
summary: one-line description
---

Your content here.
```

- The 3 most recent posts (by `date`) appear on the homepage. All posts are on `/blog/index.html`.

---

## Build & preview locally

```bash
npm run build
```

Open any generated `.html` file directly in a browser, or run a local server:

```bash
npx serve .
```

Then visit `http://localhost:3000`.

---

## Deploy to Vercel

Vercel auto-deploys on every push to `main`. The build command and output directory are already configured in `vercel.json`.

```bash
git add .
git commit -m "your message"
git push
```

That's it — Vercel picks it up automatically.
