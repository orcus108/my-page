import { promises as fs } from "node:fs";
import path from "node:path";

const EMAIL = "misravedantsocials@gmail.com";
const X_URL = "https://x.com/orcus108";
const GH_URL = "https://github.com/orcus108";
const SITE_TITLE = "Vedant Misra";

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

function shelfScript() {
  return `
    <script>
      (function () {
        var books = Array.prototype.slice.call(document.querySelectorAll('.book'));
        var touch = window.matchMedia('(hover: none)').matches;
        books.forEach(function (b) {
          b.addEventListener('click', function () {
            var open = b.classList.contains('is-out');
            books.forEach(function (o) { o.classList.remove('is-out'); });
            if (!open) b.classList.add('is-out');
          });
        });
        document.addEventListener('click', function (e) {
          if (!e.target.closest('.book')) books.forEach(function (o) { o.classList.remove('is-out'); });
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

function styles(depth) {
  const asset = (name) => (depth === 1 ? `assets/${name}` : `../assets/${name}`);
  return `
      :root {
        --bg: #ffffff;
        --fg: #0c0c0c;
        --muted: #6d6d6d;
        --faint: #9a9a9a;
        --line: #ececec;
        --topbar-bg: rgba(255, 255, 255, 0.82);
        --dot: rgba(12, 12, 12, 0.18);
        --dot-hover: rgba(12, 12, 12, 0.4);
        --shelf-line: #dcdcdc;
        --shelf-shadow: rgba(0, 0, 0, 0.55);
        --portrait-filter: none;
        --portrait-blend: multiply;
        --font: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
        --max: 1080px;
        --pad: clamp(1.5rem, 5vw, 4rem);
        --gradient: url("${asset("hero-gradient.png")}");
      }

      [data-theme="dark"] {
        --bg: #0c0c0c;
        --fg: #f2f2f2;
        --muted: #a3a3a3;
        --faint: #6a6a6a;
        --line: #262626;
        --topbar-bg: rgba(12, 12, 12, 0.72);
        --dot: rgba(242, 242, 242, 0.22);
        --dot-hover: rgba(242, 242, 242, 0.5);
        --shelf-line: #2a2a2a;
        --shelf-shadow: rgba(0, 0, 0, 0.8);
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

      /* full-height gradient hero */
      .hero {
        height: 100vh;
        height: 100svh;
        display: flex;
        flex-direction: column;
      }
      .hero-gradient {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        background-image: var(--gradient);
        background-size: cover;
        background-position: center;
      }

      /* name + bio split */
      .masthead {
        flex: 0 0 auto;
        display: grid;
        grid-template-columns: 1.25fr 1fr;
        gap: clamp(2rem, 6vw, 5rem);
        align-items: center;
        padding: clamp(1.75rem, 3.5vw, 2.75rem) 0 clamp(2.25rem, 4.5vw, 3.5rem);
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

      /* subtle gradient drift while the hero is on screen (progressive enhancement) */
      @supports (animation-timeline: scroll()) {
        @media (prefers-reduced-motion: no-preference) {
          .hero-gradient {
            animation: hero-drift linear both;
            animation-timeline: scroll(root block);
            animation-range: 0 100vh;
          }
        }
      }
      @keyframes hero-drift {
        from { transform: scale(1); }
        to { transform: scale(1.12); }
      }

      /* right-side section dots */
      .dots {
        position: fixed;
        top: 50%;
        right: clamp(1rem, 2.5vw, 1.75rem);
        transform: translateY(-50%);
        z-index: 60;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }
      .dots button {
        width: 9px;
        height: 9px;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: var(--dot);
        cursor: pointer;
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.25s ease;
      }
      .dots button:hover { transform: scale(1.4); background: var(--dot-hover); }
      .dots button.active { background: var(--fg); transform: scale(1.25); }

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
        .dots { display: none; }
      }

      /* ---- bookshelf ---- */
      .shelves { padding: clamp(2.5rem, 5vw, 4rem) 0 clamp(3.5rem, 7vw, 5.5rem); }
      .shelf-row {
        display: flex;
        align-items: flex-end;
        gap: 0 5px;
        margin-top: clamp(3.25rem, 6vw, 5rem);
        padding: 0 4px 13px;
        border-bottom: 1px solid var(--shelf-line);
        box-shadow: 0 17px 22px -20px var(--shelf-shadow);
        perspective: 2000px;
        perspective-origin: 50% 28%;
      }
      .shelf-row:first-child { margin-top: clamp(1rem, 2vw, 1.5rem); }
      .book {
        position: relative;
        flex: var(--g, 2) 1 0;
        min-width: 0;
        height: var(--h);
        padding: 0;
        border: 0;
        background: none;
        font-family: inherit;
        cursor: pointer;
      }
      .book::after {
        content: "";
        position: absolute;
        left: -3px; right: -3px; bottom: -7px;
        height: 11px;
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.3), transparent 72%);
        opacity: 0.7;
        z-index: -1;
        transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .book-3d {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
        transform-origin: bottom center;
        transform: rotate(var(--lean, 0deg));
        transition: transform 0.72s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .book-face {
        position: absolute;
        top: 0; left: 0;
        height: 100%;
        backface-visibility: hidden;
        overflow: hidden;
      }
      .book-spine {
        width: 100%;
        background: var(--c);
        background-image: linear-gradient(90deg, rgba(255,255,255,0.14), transparent 22%, transparent 80%, rgba(0,0,0,0.35));
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 0;
      }
      .book-spine .s-title {
        writing-mode: vertical-rl;
        text-orientation: mixed;
        max-height: 74%;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        color: #f4f1ea;
      }
      .book-spine .s-author {
        writing-mode: vertical-rl;
        white-space: nowrap;
        font-size: 0.58rem;
        color: rgba(244, 241, 234, 0.58);
      }
      .book-cover {
        left: 100%;
        width: var(--w);
        transform-origin: left center;
        transform: rotateY(90deg);
        background: var(--c);
        background-size: cover;
        background-position: center;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 0.95rem 0.85rem;
        box-shadow: inset 1px 0 0 rgba(255,255,255,0.08), inset 0 0 26px rgba(0,0,0,0.25);
      }
      .book-cover .c-rule { width: 22px; height: 2px; background: rgba(246,243,236,0.55); margin-bottom: 0.55rem; }
      .book-cover .c-title { font-size: 0.84rem; font-weight: 700; line-height: 1.16; letter-spacing: -0.01em; color: #f6f3ec; }
      .book-cover .c-author { font-size: 0.66rem; color: rgba(246,243,236,0.72); }
      .book-cover.has-img { padding: 0; }
      .book-cover.has-img .c-top, .book-cover.has-img .c-author { display: none; }

      /* rest = spine out; active = lift up, turn to cover */
      .book:hover, .book:focus-visible, .book.is-out { z-index: 20; outline: none; }
      .book:hover .book-3d,
      .book:focus-visible .book-3d,
      .book.is-out .book-3d {
        transform: translateY(-42px) translateZ(64px) rotateY(-90deg);
      }
      .book:hover::after,
      .book.is-out::after {
        opacity: 0.4;
        transform: translateY(46px) scale(1.25);
      }

      @media (prefers-reduced-motion: reduce) {
        .book-3d, .book::after { transition: none; }
      }

      @media (max-width: 760px) {
        .shelf-row { gap: 3rem 6px; }
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
      .work-tier-label {
        margin: 0 0 1.25rem;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--faint);
      }
      .work-tier-main .card-media-wrap { aspect-ratio: 21 / 9; }
      .work-tier-more .work-cards { margin-top: 0; }

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
        .card-media-wrap { max-width: 420px; }
        .writing-grid { grid-template-columns: 1fr; }
      }

      /* writing (home): single hero with detail column */
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
        max-height: clamp(17rem, 47vh, 32rem);
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
        #writing .writing-layout { grid-template-columns: 1fr; }
        #writing .writing-detail { justify-content: flex-start; }
        #writing .writing-detail-desc { max-width: none; }
      }
      .writing-tier { margin-bottom: clamp(2rem, 4vw, 3rem); }
      .writing-tier:last-child { margin-bottom: 0; }
      .writing-tier-main .card-media-wrap { aspect-ratio: 21 / 9; }

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
      .topbar .mark { font-weight: 700; letter-spacing: -0.02em; }
      .topbar nav { display: flex; align-items: center; gap: 1.25rem; font-size: 0.85rem; }
      .topbar nav a { color: var(--muted); }
      .topbar nav a:hover, .topbar nav a.active { color: var(--fg); }

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

      /* article / reading column */
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
        .about-grid { grid-template-columns: 1fr; gap: 2.25rem; }
        .portrait { margin: 0 auto; }
        .topbar nav { gap: 1rem; }
      }
  `;
}

function smoothScrollScript() {
  return `
    <script>
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
      })();
    </script>`;
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

function renderHighlights(items, escapeHtml, { imgPrefix = "", expanded = false } = {}) {
  const rows = items
    .map((item, i) => {
      const note = item.note
        ? `<div class="tl-note${expanded ? " is-open" : ""}">${escapeHtml(item.note)}</div>`
        : "";
      return `
        <div class="tl-entry" style="--i:${i}">
          <div class="tl-img"><img src="${imgPrefix}${item.image}" alt="" loading="lazy" /></div>
          <div class="tl-connector"><div class="tl-dot"></div></div>
          <div class="tl-body">
            <div class="tl-date">${escapeHtml(item.date)}</div>
            <div class="tl-text">${escapeHtml(item.title)}</div>
            ${note}
          </div>
        </div>`;
    })
    .join("");
  const hint = expanded ? "" : `<span class="tl-hint">hover logo for notes</span>`;
  return `
          <div class="highlights-block">
            <div class="highlights-head">
              <h3 class="highlights-title">highlights</h3>
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
        // own the scroll position so returning to the deck always opens cleanly on the hero
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var fine = window.matchMedia('(pointer: fine)').matches;
        var dotsWrap = document.querySelector('.dots');
        var topbar = document.querySelector('.topbar-home');
        var labels = ['top', 'about', 'writing', 'work', 'reading'];
        var current = 0, animating = false, cooldownUntil = 0;

        var dots = [];
        if (dotsWrap) {
          panels.forEach(function (p, i) {
            var b = document.createElement('button');
            b.type = 'button';
            b.setAttribute('aria-label', labels[i] || ('section ' + (i + 1)));
            b.addEventListener('click', function () { go(i); });
            dotsWrap.appendChild(b);
            dots.push(b);
          });
        }

        function setActive(i) {
          current = i;
          panels.forEach(function (p, j) { p.classList.toggle('is-active', j === i); });
          dots.forEach(function (d, j) { d.classList.toggle('active', j === i); });
          if (topbar) topbar.classList.toggle('show', i > 0);
        }

        var io = new IntersectionObserver(function (entries) {
          if (animating) return;
          entries.forEach(function (e) {
            if (e.isIntersecting && e.intersectionRatio >= 0.55) setActive(panels.indexOf(e.target));
          });
        }, { threshold: [0.55] });
        panels.forEach(function (p) { io.observe(p); });
        window.scrollTo(0, 0);
        setActive(0);

        // reset to the hero on bfcache restore (e.g. Safari back button)
        window.addEventListener('pageshow', function (e) {
          if (e.persisted) { window.scrollTo(0, 0); setActive(0); }
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

// runs in <head> before paint so the saved/system theme applies with no flash of light mode
function themeInitScript() {
  return `<script>(function(){try{var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>`;
}

function themeScript() {
  return `
    <script>
      function toggleTheme() {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
      }
    </script>`;
}

function topbar(base, active) {
  const link = (key, href, label) =>
    `<a href="${href}" class="${active === key ? "active" : ""}">${label}</a>`;
  return `
      <header class="topbar">
        <div class="topbar-inner">
          <a class="mark" href="${base}index.html">vedant misra</a>
          <nav>
            ${link("work", `${base}work/index.html`, "work")}
            ${link("writing", `${base}writing/index.html`, "writing")}
            ${link("about", `${base}about/index.html`, "about")}
            <a href="mailto:${EMAIL}">email</a>
            ${themeToggle()}
          </nav>
        </div>
      </header>`;
}

function footer() {
  return `
      <footer class="footer">
        <div class="footer-inner">
          <span>vedant misra</span>
          <div class="links">
            <a href="mailto:${EMAIL}">email</a>
            <a href="${X_URL}" target="_blank" rel="noopener noreferrer">x</a>
            <a href="${GH_URL}" target="_blank" rel="noopener noreferrer">github</a>
          </div>
        </div>
      </footer>`;
}

function shell({ title, body, depth, analytics, deck = false, extraScript = "" }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    ${themeInitScript()}
    <style>${styles(depth)}</style>
  </head>
  <body>
${body}
${footer()}
${analytics()}
${themeScript()}
${deck ? "" : smoothScrollScript()}
${extraScript}
  </body>
</html>`;
}

export async function buildPreviewC({
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
  const root = path.join(rootDir, "preview-c");
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

  await fs.copyFile(
    path.join(contentDir, "preview", "hero-gradient.png"),
    path.join(root, "assets", "hero-gradient.png")
  );
  await fs.copyFile(
    path.join(contentDir, "preview", "portrait.png"),
    path.join(root, "assets", "portrait.png")
  );

  // markdown body images use root-absolute paths (/images/...). the deployed site root is
  // preview-c/, so mirror the repo images dir into the output or those images 404 in prod.
  try {
    await fs.cp(path.join(rootDir, "images"), path.join(root, "images"), { recursive: true });
  } catch {}

  const homeProjectSlugs = ["friday", "sakhi"];
  const homeProjects = homeProjectSlugs
    .map((slug) => projects.find((p) => p.slug === slug))
    .filter(Boolean);
  const homeWritingHighlightSlug = home.writing?.highlight ?? "broke-countries-build-different";
  const homeWritingHighlight =
    posts.find((p) => p.slug === homeWritingHighlightSlug) ?? posts[0];
  const homeWritingMore = posts.filter((p) => p.slug !== homeWritingHighlight?.slug);

  // resolve a card image for an item, in priority order:
  //   1. frontmatter `image:` field
  //   2. drop-in convention: images/cards/<slug>.{png,jpg,jpeg,webp}
  //   3. first image used in the body
  // ...then copy it into assets/<subdir>; if none found, use a seeded gradient.
  const prepMedia = async (item, subdir) => {
    await ensureDir(path.join(root, "assets", subdir));
    const candidates = [];
    if (item.image) candidates.push(item.image.replace(/^\.?\//, ""));
    for (const ext of ["png", "jpg", "jpeg", "webp"]) candidates.push(`images/cards/${item.slug}.${ext}`);
    const bodyImg = item.body.match(/!\[[^\]]*\]\(([^)]+)\)/);
    if (bodyImg) candidates.push(bodyImg[1].trim().replace(/^\.?\//, ""));

    item.cardImg = null;
    for (const src of candidates) {
      const ext = path.extname(src) || ".png";
      try {
        await fs.access(path.join(rootDir, src));
        await fs.copyFile(path.join(rootDir, src), path.join(root, "assets", subdir, `${item.slug}${ext}`));
        item.cardImg = `assets/${subdir}/${item.slug}${ext}`;
        break;
      } catch {}
    }
    if (!item.cardImg) {
      const hue = strHash(item.slug) % 360;
      item.cardPh = `linear-gradient(135deg, hsl(${hue} 42% 84%), hsl(${(hue + 45) % 360} 46% 70%))`;
    }
  };
  for (const p of homeProjects) await prepMedia(p, "work");
  if (homeWritingHighlight) await prepMedia(homeWritingHighlight, "writing");
  for (const p of projects) await prepMedia(p, "work");
  for (const post of posts) await prepMedia(post, "writing");

  const cardEl = (item, href, i, { status = false, root = "" } = {}) => {
    const media = item.cardImg
      ? `style="background-image:url('${root}${item.cardImg}')"`
      : `style="background:${item.cardPh}"`;
    const statusEl =
      status && item.status
        ? `<span class="card-meta">${escapeHtml(item.status.toLowerCase())}</span>`
        : "";
    const reveal = i == null ? "" : ` data-reveal style="--i:${i}"`;
    return `
            <a class="card"${reveal} href="${href}">
              <span class="card-media-wrap"><span class="card-media" ${media}></span></span>
              <span class="card-title">${escapeHtml(item.title.toLowerCase())}</span>
              <span class="card-desc">${escapeHtml(item.summary.toLowerCase())}</span>
              ${statusEl}
            </a>`;
  };

  const writingHome = (lead, more, i = 1) => {
    if (!lead) return "";
    const leadMedia = lead.cardImg
      ? `style="background-image:url('${lead.cardImg}')"`
      : `style="background:${lead.cardPh}"`;
    const meta = [formatDate(lead.date), lead.readTime].filter(Boolean).join(" · ");
    const leadEl = `
      <a class="card writing-hero" data-reveal style="--i:${i}" href="writing/${lead.slug}.html">
        <span class="card-media-wrap"><span class="card-media" ${leadMedia}></span></span>
      </a>`;
    const detailEl = `
      <div class="writing-detail" data-reveal style="--i:${i + 1}">
        <p class="writing-kicker">featured essay</p>
        <h3 class="writing-detail-title">
          <a href="writing/${lead.slug}.html">${escapeHtml(lead.title.toLowerCase())}</a>
        </h3>
        ${meta ? `<p class="writing-detail-meta">${escapeHtml(meta.toLowerCase())}</p>` : ""}
        <p class="writing-detail-desc">${escapeHtml(lead.summary.toLowerCase())}</p>
      </div>`;
    return `<div class="writing-layout">${leadEl}${detailEl}</div>`;
  };

  const writingCard = (item, href, root = "") => {
    const media = item.cardImg
      ? `style="background-image:url('${root}${item.cardImg}')"`
      : `style="background:${item.cardPh}"`;
    const meta = [formatDate(item.date), item.readTime].filter(Boolean).join(" · ");
    return `
            <a class="card" href="${href}">
              <span class="card-media-wrap"><span class="card-media" ${media}></span></span>
              <span class="card-title">${escapeHtml(item.title.toLowerCase())}</span>
              <span class="card-desc">${escapeHtml(item.summary.toLowerCase())}</span>
              ${meta ? `<span class="card-meta">${escapeHtml(meta.toLowerCase())}</span>` : ""}
            </a>`;
  };

  const entry = (href, title, sub, meta, i) => `
          <a class="entry"${i == null ? "" : ` data-reveal style="--i:${i}"`} href="${href}">
            <div class="entry-row">
              <h3 class="entry-title">${escapeHtml(title.toLowerCase())}</h3>
              ${meta ? `<span class="entry-meta">${escapeHtml(meta.toLowerCase())}</span>` : ""}
            </div>
            ${sub ? `<p class="entry-sub">${escapeHtml(sub.toLowerCase())}</p>` : ""}
          </a>`;

  // ---- home (one-pager, full-page deck) ----
  const homeBody = `
    <header class="topbar topbar-home">
      <div class="topbar-inner">
        <a class="mark" href="#hero">vedant misra</a>
        <nav>
          <a href="about/index.html">about</a>
          <a href="writing/index.html">writing</a>
          <a href="work/index.html">work</a>
          <a href="mailto:${EMAIL}">email</a>
          ${themeToggle()}
        </nav>
      </div>
    </header>

    <main>
      <section class="hero panel" id="hero">
        <div class="hero-gradient" role="presentation"></div>
        <div class="wrap masthead">
          <h1 data-reveal style="--i:0">${escapeHtml(home.hero.name)}</h1>
          <div class="masthead-bio">
            <p class="bio" data-reveal style="--i:1">${escapeHtml(home.hero.bio)}</p>
            ${
              homeWritingHighlight
                ? `<p class="hero-essay" data-reveal style="--i:2"><a href="writing/${homeWritingHighlight.slug}.html">${escapeHtml((home.writing?.heroLink ?? "why i think this →").toLowerCase())}</a></p>`
                : ""
            }
          </div>
        </div>
      </section>

      <section class="section panel" id="about">
        <div class="wrap">
          <h2 class="sec-title" data-reveal style="--i:0">about</h2>
          <div class="about-grid">
            <div>
              <div class="about-body" data-reveal style="--i:1">${markdownToHtml(aboutRaw)}</div>
              <div class="contact" data-reveal style="--i:2">
                <a href="mailto:${EMAIL}">email</a><span class="dot">·</span>
                <a href="${X_URL}" target="_blank" rel="noopener noreferrer">x (twitter)</a><span class="dot">·</span>
                <a href="${GH_URL}" target="_blank" rel="noopener noreferrer">github</a>
              </div>
            </div>
            <img class="portrait" data-reveal style="--i:1" src="assets/portrait.png" alt="Vedant Misra" />
          </div>
        </div>
      </section>

      <section class="section panel" id="writing">
        <div class="wrap">
          <div class="sec-head">
            <a class="sec-title sec-title-link" data-reveal style="--i:0" href="writing/index.html">writing</a>
            <a class="see-all" data-reveal style="--i:0" href="writing/index.html">see all <span class="arr">→</span></a>
          </div>
          ${writingHome(homeWritingHighlight, homeWritingMore)}
        </div>
      </section>

      <section class="section panel" id="work">
        <div class="wrap">
          <div class="sec-head">
            <a class="sec-title sec-title-link" data-reveal style="--i:0" href="work/index.html">work</a>
            <a class="see-all" data-reveal style="--i:0" href="work/index.html">see all <span class="arr">→</span></a>
          </div>
          <div class="work-cards">
            ${homeProjects.map((p, i) => cardEl(p, `work/${p.slug}.html`, i + 1)).join("")}
          </div>
        </div>
      </section>

      <section class="section panel" id="reading">
        <div class="wrap">
          <div class="sec-head">
            <h2 class="sec-title" data-reveal style="--i:0">reading</h2>
            <a class="see-all" data-reveal style="--i:0" href="about/index.html#bookshelf">bookshelf <span class="arr">→</span></a>
          </div>
          <div class="reading-block">
            <p class="eyebrow" data-reveal style="--i:1">currently</p>
            <p class="reading-title" data-reveal style="--i:2">${escapeHtml(home.reading.title)}</p>
            <p class="reading-author" data-reveal style="--i:3">by ${escapeHtml(home.reading.author)}</p>
            ${home.reading.note ? `<p class="reading-note" data-reveal style="--i:4">${escapeHtml(home.reading.note)}</p>` : ""}
          </div>
        </div>
      </section>
    </main>

    <div class="dots" aria-hidden="true"></div>`;

  await writeFile(
    path.join(root, "index.html"),
    shell({
      title: SITE_TITLE,
      body: homeBody,
      depth: 1,
      analytics: vercelAnalyticsScript,
      deck: true,
      extraScript: deckScript(),
    })
  );

  // ---- writing list ----
  const writingHighlight =
    posts.find((p) => p.slug === homeWritingHighlightSlug) ?? posts[0];
  const writingOthers = posts.filter((p) => p.slug !== writingHighlight?.slug);

  const writingList = `
    ${topbar("../", "writing")}
    <main class="wrap page-writing">
      <div class="article-head">
        <h1>writing</h1>
        <p class="lead">essays on AI, India, and what actually changes people's lives.</p>
      </div>
      ${writingHighlight ? `<div class="writing-tier writing-tier-main">${writingCard(writingHighlight, `${writingHighlight.slug}.html`, relRoot(2))}</div>` : ""}
      ${
        writingOthers.length
          ? `<div class="writing-tier writing-tier-more">
        <p class="work-tier-label">more</p>
        <div class="writing-grid">
          ${writingOthers.map((p) => writingCard(p, `${p.slug}.html`, relRoot(2))).join("")}
        </div>
      </div>`
          : ""
      }
    </main>`;
  await writeFile(
    path.join(root, "writing", "index.html"),
    shell({ title: `Writing — ${SITE_TITLE}`, body: writingList, depth: 2, analytics: vercelAnalyticsScript })
  );

  // ---- individual posts ----
  for (const post of posts) {
    const meta = [formatDate(post.date), post.readTime].filter(Boolean).join(" · ");
    const body = `
    ${topbar("../", "writing")}
    <main class="wrap">
      <div class="article-head">
        <h1>${escapeHtml(post.title.toLowerCase())}</h1>
        ${post.summary ? `<p class="lead">${escapeHtml(post.summary)}</p>` : ""}
        ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ""}
      </div>
      <article class="prose">${post.htmlBody}</article>
    </main>`;
    await writeFile(
      path.join(root, "writing", `${post.slug}.html`),
      shell({ title: `${post.title} — ${SITE_TITLE}`, body, depth: 2, analytics: vercelAnalyticsScript })
    );
  }

  // ---- work list ----
  const friday = projects.find((p) => p.slug === "friday");
  const sakhi = projects.find((p) => p.slug === "sakhi");
  const otherProjects = projects.filter((p) => p.slug !== "friday" && p.slug !== "sakhi");

  const workList = `
    ${topbar("../", "work")}
    <main class="wrap page-work">
      <div class="article-head">
        <h1>work</h1>
        <p class="lead">things i've built. product first — not demos for demo's sake.</p>
      </div>
      ${friday ? `<div class="work-tier work-tier-main">${cardEl(friday, `${friday.slug}.html`, null, { root: relRoot(2) })}</div>` : ""}
      ${sakhi ? `<div class="work-tier work-tier-main">${cardEl(sakhi, `${sakhi.slug}.html`, null, { root: relRoot(2) })}</div>` : ""}
      ${
        otherProjects.length
          ? `<div class="work-tier work-tier-more">
        <p class="work-tier-label">more</p>
        <div class="work-cards">
          ${otherProjects.map((p) => cardEl(p, `${p.slug}.html`, null, { root: relRoot(2) })).join("")}
        </div>
      </div>`
          : ""
      }
    </main>`;
  await writeFile(
    path.join(root, "work", "index.html"),
    shell({ title: `Work — ${SITE_TITLE}`, body: workList, depth: 2, analytics: vercelAnalyticsScript })
  );

  // ---- individual projects ----
  for (const project of projects) {
    const { story, technical } = splitProjectBody(project.body);
    const panelId = `depth-${project.slug}`;
    const metaBits = [project.status, project.date ? formatDate(project.date) : ""].filter(Boolean).join(" · ");
    const body = `
    ${topbar("../", "work")}
    <main class="wrap">
      <div class="article-head">
        <h1>${escapeHtml(project.title.toLowerCase())}</h1>
        ${project.summary ? `<p class="lead">${escapeHtml(project.summary)}</p>` : ""}
        ${metaBits ? `<p class="meta">${escapeHtml(metaBits.toLowerCase())}</p>` : ""}
        ${
          project.demo || project.repo
            ? `<div class="article-links">
          ${project.demo ? `<a href="${escapeHtml(project.demo)}" target="_blank" rel="noopener noreferrer">demo</a>` : ""}
          ${project.repo ? `<a href="${escapeHtml(project.repo)}" target="_blank" rel="noopener noreferrer">source</a>` : ""}
        </div>`
            : ""
        }
      </div>
      <article class="prose">
        ${markdownToHtml(story)}
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
            <span class="caret">›</span><span class="label">technical details</span>
          </button>
          <div class="depth-panel" id="${panelId}" hidden>${markdownToHtml(technical)}</div>
        </div>`
            : ""
        }
      </article>
    </main>`;
    await writeFile(
      path.join(root, "work", `${project.slug}.html`),
      shell({
        title: `${project.title} — ${SITE_TITLE}`,
        body,
        depth: 2,
        analytics: vercelAnalyticsScript,
        extraScript: technical ? depthScript() : "",
      })
    );
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
            <div>${markdownToHtml(e.body)}</div>
          </div>`
            )
            .join("")}
        </div>`
        )
        .join("")
    : `<p class="badge">no entries yet.</p>`;

  const coverExts = ["jpg", "jpeg", "png", "webp"];
  for (const b of books) {
    b.slug = slugify(b.title);
    b.coverFile = null;
    for (const ext of coverExts) {
      const src = path.join(contentDir, "preview", "books", `${b.slug}.${ext}`);
      try {
        await fs.access(src);
        await fs.copyFile(src, path.join(root, "assets", "books", `${b.slug}.${ext}`));
        b.coverFile = `assets/books/${b.slug}.${ext}`;
        break;
      } catch {}
    }
  }

  const ROWS = 2;
  const per = Math.ceil(books.length / ROWS);
  const bookRows = [];
  for (let i = 0; i < books.length; i += per) bookRows.push(books.slice(i, i + per));

  const bookEl = (b) => {
    const h = 198 + (strHash(b.title) % 6) * 13;
    const w = Math.round(h * 0.66);
    const g = (1 + (strHash(b.title + "g") % 5) * 0.6).toFixed(2);
    const lh = strHash(b.title + "lean");
    const lean = lh % 3 === 0 ? (lh % 2 ? 1 : -1) * (3 + (lh % 5)) : 0;
    const hasImg = Boolean(b.coverFile);
    const coverStyle = hasImg ? `;background-image:url('${relRoot(2)}${b.coverFile}')` : "";
    return `
            <button class="book" style="--h:${h}px;--w:${w}px;--g:${g};--lean:${lean}deg;--c:${escapeHtml(b.color || "#33384a")}${coverStyle}" aria-label="${escapeHtml(b.title)} by ${escapeHtml(b.author)}">
              <span class="book-3d">
                <span class="book-face book-spine">
                  <span class="s-title">${escapeHtml(b.title)}</span>
                  <span class="s-author">${escapeHtml(b.author)}</span>
                </span>
                <span class="book-face book-cover${hasImg ? " has-img" : ""}">
                  <span class="c-top"><span class="c-rule"></span><span class="c-title">${escapeHtml(b.title)}</span></span>
                  <span class="c-author">${escapeHtml(b.author)}</span>
                </span>
              </span>
            </button>`;
  };

  const shelvesHtml = bookRows.map((row) => `<div class="shelf-row">${row.map(bookEl).join("")}</div>`).join("");

  const aboutBody = `
    ${topbar("../", "about")}
    <main class="wrap page-about">
      <div class="article-head">
        <h1>about</h1>
        <div class="prose">${markdownToHtml(aboutPageRaw)}</div>
      </div>

      <section class="about-section" id="highlights">
        ${renderHighlights(highlights, escapeHtml, { imgPrefix: relRoot(2) })}
      </section>

      <section class="about-section" id="misc">
        <h2 class="section-label">misc</h2>
        <article class="prose">${markdownToHtml(aboutMiscRaw)}</article>
      </section>

      <section class="about-section" id="bookshelf">
        <h2 class="section-label">bookshelf</h2>
        <p class="lead" style="margin:0 0 1.5rem;font-size:0.95rem;color:var(--muted)">books that shaped how i think. hover or tap a spine to pull it off the shelf.</p>
        <div class="shelves">${shelvesHtml}</div>
      </section>

      <section class="about-section" id="log">
        <button type="button" class="section-toggle" aria-expanded="false" aria-controls="log-panel">
          <span class="caret">›</span>
          <span class="label">log</span>
        </button>
        <div class="section-panel" id="log-panel" hidden>
          <p class="lead" style="margin:0 0 1.5rem;font-size:0.95rem;color:var(--muted)">a running record of what i'm building, reading, and thinking about.</p>
          <div>${logHtml}</div>
        </div>
      </section>
    </main>`;

  await writeFile(
    path.join(root, "about", "index.html"),
    shell({
      title: `About — ${SITE_TITLE}`,
      body: aboutBody,
      depth: 2,
      analytics: vercelAnalyticsScript,
      extraScript: timelineScript() + shelfScript() + aboutToggleScript(),
    })
  );

  await fs.rm(path.join(root, "log"), { recursive: true, force: true }).catch(() => {});
  await fs.rm(path.join(root, "reading"), { recursive: true, force: true }).catch(() => {});

  console.log(`Built preview-c/ (${projects.length} work, ${posts.length} writing, ${logs.length} log entries, ${books.length} books).`);
}
