# Personal Site (Markdown-driven)

## Add a new project
1. Create a file in `content/projects/` named `<slug>.md`.
2. Use this format:

```md
---
title: Project Title
slug: project-slug
summary: One-line summary
date: 2026-02-12
stack: Tech 1, Tech 2
status: In progress
---
Write the project overview here.
```

## Add a new blog post
1. Create a file in `content/blog/` named `<slug>.md`.
2. Use this format:

```md
---
title: Post Title
slug: post-slug
date: 2026-02-12
read_time: 4 min read
summary: One-line summary
---
Write your post here.
```

## Build pages
Run:

```bash
npm run build
```

This regenerates:
- `index.html`
- `projects/*.html`
- `blog/*.html`

## Notes
- Social links are placeholders (`#`) in the header on all pages.
- Theme preference is persisted using `localStorage`.
