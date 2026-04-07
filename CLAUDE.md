# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build    # Generate all HTML from markdown content
```

There is no dev server, test suite, or linter. After changes to `scripts/build.mjs` or content files, run the build and inspect the generated HTML.

## Architecture

This is a zero-dependency static site generator. The entire build pipeline lives in [scripts/build.mjs](scripts/build.mjs) (~562 lines). It:

1. Reads markdown files from `content/projects/` and `content/blog/`
2. Parses YAML frontmatter and converts markdown to HTML using a custom renderer (no external libs)
3. Writes generated pages to `projects/`, `blog/`, and `index.html` at the root

### Content → Output mapping

| Source | Output |
|---|---|
| `content/projects/<slug>.md` | `projects/<slug>/index.html` |
| `content/blog/<slug>.md` | `blog/<slug>/index.html` |
| (aggregated) | `index.html` |

### Frontmatter schemas

**Projects:** `title`, `slug`, `summary`, `date`, `status`, `stack` (array), `repo`, `demo`

**Blog posts:** `title`, `slug`, `date`, `read_time`, `summary`

### Styling & theming

All CSS is embedded directly in generated HTML by `build.mjs`. There is no external stylesheet. Light/dark mode uses CSS variables (`--bg`, `--fg`, etc.) toggled via `localStorage` with `prefers-color-scheme` as fallback.

### Deployment

Deployed on Vercel. `vercel.json` sets `buildCommand: npm run build` and `outputDirectory: .` (repo root). The generated HTML files are committed to the repo and served directly.
