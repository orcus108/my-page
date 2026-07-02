// shared book lookup + cover/colour helpers used by the dashboard (and reusable by
// the bulk fetch script). zero deps beyond jpeg-js for dominant-colour extraction.
import jpeg from "jpeg-js";

const UA = "pers-bookshelf/1.0 (contact: local)";
const MIN_COVER_BYTES = 4000;

export function slugify(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isbn10(isbn13) {
  if (!isbn13 || String(isbn13).length !== 13 || !String(isbn13).startsWith("978")) return null;
  const core = String(isbn13).slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(core[i]) * (10 - i);
  const rem = (11 - (sum % 11)) % 11;
  return core + (rem === 10 ? "X" : String(rem));
}

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch {
      if (i === retries - 1) throw new Error(`lookup failed: ${url}`);
      await sleep(600 * (i + 1));
    }
  }
}

async function fetchImage(url, minBytes = MIN_COVER_BYTES) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(25000) });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") || "").includes("image")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length >= minBytes ? buf : null;
  } catch {
    return null;
  }
}

function coverCandidates(isbn13, coverId, titleSlug) {
  const urls = [];
  if (coverId) urls.push(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg`);
  if (isbn13) {
    urls.push(`https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`);
    urls.push(`https://images.penguinrandomhouse.com/cover/${isbn13}`);
    urls.push(`https://prodimage.images-bn.com/pimages/${isbn13}.jpg`);
    const i10 = isbn10(isbn13);
    if (i10) urls.push(`https://prodimage.images-bn.com/pimages/${i10}.jpg`);
    if (titleSlug) {
      urls.push(`https://d28hgpri8am2if.cloudfront.net/book_images/onix/cvr${isbn13}/${titleSlug}-${isbn13}_hr.jpg`);
    }
  }
  return [...new Set(urls)];
}

/** Search Open Library for a title (+ optional author) and return normalized metadata. */
export async function lookupBook(title, author = "") {
  const firstAuthor = String(author || "").split(/[,&]/)[0].trim();
  const q = encodeURIComponent(`${title} ${firstAuthor}`.trim());
  const data = await fetchJson(
    `https://openlibrary.org/search.json?q=${q}&limit=5&fields=key,title,author_name,isbn,cover_i,edition_key,number_of_pages_median`
  );
  const needle = String(title).toLowerCase().split(" ")[0];
  const doc = (data.docs || []).find((d) => (d.title || "").toLowerCase().includes(needle)) || (data.docs || [])[0];
  if (!doc) return null;

  const isbns = new Set((doc.isbn || []).map(String));
  let pages = doc.number_of_pages_median || null;
  // crawl a few editions for sharper isbns/page counts
  for (const ek of (doc.edition_key || []).slice(0, 6)) {
    try {
      const ed = await fetchJson(`https://openlibrary.org/books/${ek}.json`);
      for (const i of [...(ed.isbn_13 || []), ...(ed.isbn_10 || [])]) isbns.add(String(i));
      const p = ed.number_of_pages || parseInt(String(ed.pagination || "").replace(/\D/g, ""), 10) || null;
      if (p && p > 20 && !pages) pages = p;
    } catch {
      /* skip edition */
    }
    await sleep(70);
  }

  const isbnList = [...isbns];
  return {
    title: doc.title || title,
    author: author || (doc.author_name || []).join(", ") || "",
    pages: pages && pages > 20 ? pages : null,
    isbn: isbnList.find((i) => i.length === 13) || isbnList[0] || null,
    isbns: isbnList,
    coverId: doc.cover_i || null,
  };
}

/** Try the cover sources in order; return the first image buffer + its url, or null. */
export async function fetchCoverBuffer(meta) {
  const slug = slugify(meta.title || "");
  const isbns = [meta.isbn, ...(meta.isbns || [])].filter(Boolean);
  for (const isbn of isbns) {
    for (const url of coverCandidates(isbn, meta.coverId, slug)) {
      const buf = await fetchImage(url);
      if (buf) return { buffer: buf, url };
      await sleep(120);
    }
  }
  if (meta.coverId) {
    const url = `https://covers.openlibrary.org/b/id/${meta.coverId}-L.jpg`;
    const buf = await fetchImage(url);
    if (buf) return { buffer: buf, url };
  }
  return null;
}

function satOf(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}
const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/**
 * Representative dominant colour for a JPEG cover buffer, returned as #rrggbb.
 * Favours vivid, common colours; ignores near-white/black unless nothing else
 * exists. Returns null if the buffer can't be decoded as JPEG.
 */
export function dominantColor(jpegBuffer) {
  let img;
  try {
    img = jpeg.decode(jpegBuffer, { useTArray: true, maxMemoryUsageInMB: 512 });
  } catch {
    return null;
  }
  const { data, width, height } = img;
  const buckets = new Map();
  const total = width * height;
  const step = Math.max(1, Math.floor(total / 6000));
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    if (data[o + 3] < 200) continue;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    let e = buckets.get(key);
    if (!e) { e = { count: 0, r: 0, g: 0, b: 0 }; buckets.set(key, e); }
    e.count++; e.r += r; e.g += g; e.b += b;
  }
  let best = null, bestScore = -1, neutral = null, neutralScore = -1;
  for (const e of buckets.values()) {
    const r = e.r / e.count, g = e.g / e.count, b = e.b / e.count;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const extreme = min > 232 || max < 26;
    const score = e.count * (0.18 + satOf(r, g, b) * 1.9);
    if (!extreme && score > bestScore) { bestScore = score; best = { r, g, b }; }
    const ns = e.count * (1 - Math.abs((r + g + b) / 3 - 128) / 128);
    if (ns > neutralScore) { neutralScore = ns; neutral = { r, g, b }; }
  }
  const p = best || neutral;
  return p ? `#${toHex(p.r)}${toHex(p.g)}${toHex(p.b)}` : null;
}
