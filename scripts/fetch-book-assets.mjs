#!/usr/bin/env node
/**
 * Fetch cover + spine for every bookshelf book. Retries multiple sources until both exist.
 * Covers: Open Library, Penguin/Random House, Barnes & Noble, Simon & Schuster CDN.
 * Spines: opencover.jp (tries primary ISBN + Open Library edition ISBNs).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const booksJsonPath = path.join(root, "content", "preview", "books.json");
const booksDir = path.join(root, "content", "preview", "books");

const UA = "pers-bookshelf/1.0 (contact: local)";
const MIN_COVER_BYTES = 4000;
const MIN_SPINE_BYTES = 1000;

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isbn10(isbn13) {
  if (!isbn13 || String(isbn13).length !== 13 || !String(isbn13).startsWith("978")) return null;
  const core = String(isbn13).slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(core[i]) * (10 - i);
  const rem = (11 - (sum % 11)) % 11;
  const check = rem === 10 ? "X" : String(rem);
  return core + check;
}

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch {
      if (i === retries - 1) throw new Error(`json failed: ${url}`);
      await sleep(800 * (i + 1));
    }
  }
}

async function downloadImage(url, dest, minBytes = MIN_COVER_BYTES) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("image")) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < minBytes) return false;
    await fs.writeFile(dest, buf);
    return true;
  } catch {
    return false;
  }
}

function coverCandidates(isbn13, coverId, titleSlug) {
  const urls = [];
  if (coverId) urls.push(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg`);
  if (isbn13) {
    urls.push(`https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`);
    urls.push(`https://images.penguinrandomhouse.com/cover/${isbn13}`);
    urls.push(`https://images.randomhouse.com/cover/${isbn13}`);
    urls.push(`https://prodimage.images-bn.com/pimages/${isbn13}.jpg`);
    const i10 = isbn10(isbn13);
    if (i10) {
      urls.push(`https://prodimage.images-bn.com/pimages/${i10}.jpg`);
      urls.push(`https://images-us.bookshop.org/ingram/${isbn13}.jpg`);
    }
    if (titleSlug) {
      urls.push(
        `https://d28hgpri8am2if.cloudfront.net/book_images/onix/cvr${isbn13}/${titleSlug}-${isbn13}_hr.jpg`
      );
    }
    const wpath = isbn13.replace(/(\d{4})(\d{3})(\d{3})(\d)/, "$1/$2/$3$4");
    urls.push(`https://cdn.waterstones.com/bookjackets/large/${wpath}.jpg`);
  }
  return [...new Set(urls)];
}

async function searchOpenLibrary(title, author) {
  const q = encodeURIComponent(`${title} ${author.split(/[,&]/)[0].trim()}`);
  const data = await fetchJson(
    `https://openlibrary.org/search.json?q=${q}&limit=5&fields=key,title,author_name,isbn,cover_i,edition_key`
  );
  const needle = title.toLowerCase();
  const doc =
    data.docs?.find((d) => (d.title || "").toLowerCase().includes(needle.split(" ")[0])) ||
    data.docs?.[0];
  if (!doc) return { coverId: null, isbns: [], pages: null };

  const isbns = new Set((doc.isbn || []).map(String));
  let pages = null;

  for (const ek of (doc.edition_key || []).slice(0, 20)) {
    try {
      const ed = await fetchJson(`https://openlibrary.org/books/${ek}.json`);
      for (const i of [...(ed.isbn_13 || []), ...(ed.isbn_10 || [])]) isbns.add(String(i));
      const p =
        ed.number_of_pages ||
        parseInt(String(ed.pagination || "").replace(/\D/g, ""), 10) ||
        null;
      if (p && p > 20 && !pages) pages = p;
    } catch {
      /* next edition */
    }
    await sleep(120);
  }

  return { coverId: doc.cover_i, isbns: [...isbns], pages };
}

async function tryDownloadCover(isbns, coverId, titleSlug, dest) {
  for (const isbn of isbns) {
    for (const url of coverCandidates(isbn, coverId, titleSlug)) {
      if (await downloadImage(url, dest, MIN_COVER_BYTES)) return { ok: true, isbn, url };
      await sleep(150);
    }
  }
  return { ok: false };
}

async function tryDownloadSpine(isbns, dest) {
  const tried = new Set();
  for (const raw of isbns) {
    const candidates = [String(raw)];
    if (String(raw).length === 13 && String(raw).startsWith("978")) {
      const i10 = isbn10(raw);
      if (i10) candidates.push(i10);
    }
    for (const isbn of candidates) {
      if (tried.has(isbn)) continue;
      tried.add(isbn);
      const url = `https://image.opencover.jp/v1/cover/spine/${isbn}.webp`;
      if (await downloadImage(url, dest, MIN_SPINE_BYTES)) return { ok: true, isbn, url };
      await sleep(180);
    }
  }
  return { ok: false };
}

const ISBN_OVERRIDES = {
  "high-output-management": "9780679762881",
  "the-age-of-ai": "9780316273800",
  "life-3-0": "9781101946596",
  "the-coming-wave": "9781529923834",
  "power-and-progress": "9781541702554",
  "steve-jobs": "9781451648539",
  "elon-musk": "9781982181284",
  "the-innovators": "9781476708690",
  "the-code-breaker": "9781982115855",
  "creativity-inc": "9780812993011",
  "the-hard-thing-about-hard-things": "9780062273208",
  "chip-war": "9781982172008",
  "apple-in-china": "9781668053393",
  "the-undercover-economist": "9780195189773",
  "the-india-way": "9789353579791",
  "breaking-the-mould": "9780670099894",
  "predictably-irrational": "9780061353239",
  "never-split-the-difference": "9780062407801",
  "the-splendid-and-the-vile": "9780385340828",
  "the-spy-and-the-traitor": "9781101904190",
  "the-denial-of-death": "9780684832401",
  "hard-times": "9780394745604",
};

/** opencover often needs a different edition ISBN than the US cover ISBN */
const SPINE_ISBN_PRIORITY = {
  "power-and-progress": ["9781541702530", "9781399804455", "9781541702554"],
  "the-code-breaker": ["9781982115852", "9781398502314", "9781982115855"],
  "breaking-the-mould": ["9780670099900", "9780670099894"],
  "hard-times": ["9781565846562", "9780394745604"],
  "the-splendid-and-the-vile": ["9780385348737", "9780593172070", "9780385340828"],
  "apple-in-china": ["9781668053379", "9781668053393", "9781398534360"],
  "the-india-way": ["9789353579791", "9789394407213", "9789390902968"],
};

const PAGE_OVERRIDES = {
  "high-output-management": 272,
  "the-age-of-ai": 272,
  "life-3-0": 384,
  "power-and-progress": 560,
  "the-hard-thing-about-hard-things": 304,
  "steve-jobs": 656,
  "apple-in-china": 352,
  "breaking-the-mould": 336,
  "predictably-irrational": 304,
  "the-splendid-and-the-vile": 608,
  "the-india-way": 240,
};

const books = JSON.parse(await fs.readFile(booksJsonPath, "utf8"));

console.log(`Fetching cover + spine for ${books.length} books (no fallbacks)...\n`);

const results = [];

for (const book of books) {
  const slug = slugify(book.title);
  book.slug = slug;
  const dir = path.join(booksDir, slug);
  await fs.mkdir(dir, { recursive: true });

  const coverPath = path.join(dir, "cover.jpg");
  const spinePath = path.join(dir, "spine.webp");

  process.stdout.write(`${book.title}\n`);

  let ol = { coverId: null, isbns: [], pages: null };
  try {
    ol = await searchOpenLibrary(book.title, book.author);
  } catch (e) {
    process.stdout.write(`  open library: ${e.message}\n`);
  }

  const primaryIsbn = ISBN_OVERRIDES[slug] || null;
  const coverIsbns = [
    primaryIsbn,
    ...(SPINE_ISBN_PRIORITY[slug] || []),
    ...ol.isbns,
  ].filter(Boolean);

  const spineIsbns = [
    ...(SPINE_ISBN_PRIORITY[slug] || []),
    primaryIsbn,
    ...ol.isbns,
  ].filter(Boolean);

  book.isbn = primaryIsbn || ol.isbns.find((i) => String(i).length === 13) || ol.isbns[0] || null;
  book.pages = PAGE_OVERRIDES[slug] || (ol.pages && ol.pages > 20 ? ol.pages : null);

  let coverResult = { ok: false };
  for (let attempt = 1; attempt <= 3 && !coverResult.ok; attempt++) {
    if (attempt > 1) {
      process.stdout.write(`  cover retry ${attempt}...\n`);
      await sleep(1500 * attempt);
    }
    coverResult = await tryDownloadCover(coverIsbns, ol.coverId, slug, coverPath);
  }

  let spineResult = { ok: false };
  for (let attempt = 1; attempt <= 3 && !spineResult.ok; attempt++) {
    if (attempt > 1) {
      process.stdout.write(`  spine retry ${attempt}...\n`);
      await sleep(1500 * attempt);
      if (attempt === 3 && ol.isbns.length < 30) {
        try {
          const more = await searchOpenLibrary(`${book.title} ${book.author}`, book.author);
          spineIsbns.push(...more.isbns);
        } catch {}
      }
    }
    spineResult = await tryDownloadSpine(spineIsbns, spinePath);
  }

  if (coverResult.ok) {
    book.coverFile = `books/${slug}/cover.jpg`;
    book.coverSource = coverResult.url;
    book.coverIsbn = coverResult.isbn;
  } else {
    book.coverFile = null;
    book.coverSource = null;
  }

  if (spineResult.ok) {
    book.spineFile = `books/${slug}/spine.webp`;
    book.spineSource = "opencover";
    book.spineIsbn = spineResult.isbn;
  } else {
    book.spineFile = null;
    book.spineSource = null;
  }

  const status = `  cover=${coverResult.ok ? "ok" : "MISSING"} spine=${spineResult.ok ? "ok" : "MISSING"} isbn=${book.isbn || "?"} pages=${book.pages || "?"}`;
  console.log(status);
  if (!coverResult.ok || !spineResult.ok) console.log("  *** INCOMPLETE ***");

  results.push({
    title: book.title,
    slug,
    isbn: book.isbn,
    pages: book.pages,
    coverOk: coverResult.ok,
    spineOk: spineResult.ok,
    coverIsbn: coverResult.isbn,
    spineIsbn: spineResult.isbn,
  });

  await sleep(400);
}

await fs.writeFile(booksJsonPath, JSON.stringify(books, null, 2) + "\n");
await fs.writeFile(path.join(booksDir, "manifest.json"), JSON.stringify(results, null, 2) + "\n");

const incomplete = results.filter((r) => !r.coverOk || !r.spineOk);
console.log(`\nComplete: ${results.length - incomplete.length}/${results.length}`);
if (incomplete.length) {
  console.log("Incomplete:", incomplete.map((r) => r.slug).join(", "));
  process.exit(1);
}

console.log("All books have cover + spine.");
