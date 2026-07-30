import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_CONFIG } from "./lib/site-config.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(rootDir, "site");
const expectedOrigin = new URL(SITE_CONFIG.siteUrl).origin;
const errors = [];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

function decodeEntities(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function matchOne(html, pattern, label, relativePath) {
  const matches = [...html.matchAll(pattern)];
  if (matches.length !== 1) {
    errors.push(`${relativePath}: expected one ${label}, found ${matches.length}`);
    return "";
  }
  return decodeEntities(matches[0][1].trim());
}

function outputFileForUrl(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  if (decoded === "/" || decoded.endsWith("/")) {
    return path.join(siteDir, decoded.replace(/^\//, ""), "index.html");
  }
  return path.join(siteDir, decoded.replace(/^\//, ""));
}

function pagePathForFile(filePath) {
  const relative = path.relative(siteDir, filePath).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return `/${relative.slice(0, -"index.html".length)}`;
  return `/${relative}`;
}

const allFiles = await walk(siteDir);
const htmlFiles = allFiles.filter((file) => file.endsWith(".html"));
const pageRecords = [];
const seenTitles = new Map();
const seenDescriptions = new Map();
const seenCanonicals = new Map();

for (const filePath of htmlFiles) {
  const relativePath = path.relative(siteDir, filePath).split(path.sep).join("/");
  const html = await fs.readFile(filePath, "utf8");
  const title = matchOne(html, /<title>([\s\S]*?)<\/title>/gi, "title", relativePath);
  const description = matchOne(html, /<meta\s+name="description"\s+content="([^"]*)"\s*\/?\s*>/gi, "meta description", relativePath);
  const canonical = matchOne(html, /<link\s+rel="canonical"\s+href="([^"]+)"\s*\/?\s*>/gi, "canonical link", relativePath);
  const h1Count = (html.match(/<h1(?:\s[^>]*)?>/gi) || []).length;
  if (h1Count !== 1) errors.push(`${relativePath}: expected one h1, found ${h1Count}`);
  if (/name="robots"[^>]*content="[^"]*noindex/i.test(html)) errors.push(`${relativePath}: unexpectedly contains noindex`);
  if (description.length < 70 || description.length > 170) errors.push(`${relativePath}: meta description is ${description.length} characters`);

  for (const [value, label, seen] of [
    [title, "title", seenTitles],
    [description, "meta description", seenDescriptions],
    [canonical, "canonical", seenCanonicals],
  ]) {
    if (!value) continue;
    if (seen.has(value)) errors.push(`${relativePath}: duplicate ${label} also used by ${seen.get(value)}`);
    else seen.set(value, relativePath);
  }

  if (canonical) {
    let canonicalUrl;
    try {
      canonicalUrl = new URL(canonical);
    } catch {
      errors.push(`${relativePath}: invalid canonical URL ${canonical}`);
    }
    if (canonicalUrl) {
      if (canonicalUrl.origin !== expectedOrigin) errors.push(`${relativePath}: canonical uses unexpected origin ${canonicalUrl.origin}`);
      const expectedPath = pagePathForFile(filePath);
      if (canonicalUrl.pathname !== expectedPath) errors.push(`${relativePath}: canonical path ${canonicalUrl.pathname} should be ${expectedPath}`);
    }
  }

  for (const match of html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      errors.push(`${relativePath}: invalid JSON-LD (${error.message})`);
    }
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt="[^"]*"/i.test(match[1])) errors.push(`${relativePath}: image is missing an alt attribute`);
  }

  const pageUrl = new URL(canonical || pagePathForFile(filePath), SITE_CONFIG.siteUrl);
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) {
    const href = decodeEntities(match[1]);
    if (!href || href.startsWith("#") || /^(?:mailto|tel|javascript):/i.test(href)) continue;
    let target;
    try {
      target = new URL(href, pageUrl);
    } catch {
      errors.push(`${relativePath}: invalid link ${href}`);
      continue;
    }
    if (target.origin !== expectedOrigin) continue;
    if (/\/index\.html$/i.test(target.pathname)) errors.push(`${relativePath}: internal link uses duplicate index.html URL ${href}`);
    if (target.pathname.startsWith("/_vercel/")) continue;
    const targetFile = outputFileForUrl(target.pathname);
    try {
      await fs.access(targetFile);
    } catch {
      errors.push(`${relativePath}: broken internal link ${href}`);
    }
  }

  pageRecords.push({ relativePath, canonical });
}

const sitemap = await fs.readFile(path.join(siteDir, "sitemap.xml"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeEntities(match[1]));
const sitemapSet = new Set(sitemapUrls);
if (sitemapSet.size !== sitemapUrls.length) errors.push("sitemap.xml: duplicate URLs found");
for (const page of pageRecords) {
  if (page.canonical && !sitemapSet.has(page.canonical)) errors.push(`${page.relativePath}: canonical is missing from sitemap.xml`);
}
for (const url of sitemapSet) {
  const parsed = new URL(url);
  if (parsed.origin !== expectedOrigin) errors.push(`sitemap.xml: unexpected origin in ${url}`);
  try {
    await fs.access(outputFileForUrl(parsed.pathname));
  } catch {
    errors.push(`sitemap.xml: URL has no generated page ${url}`);
  }
}

const robots = await fs.readFile(path.join(siteDir, "robots.txt"), "utf8");
for (const required of ["OAI-SearchBot", "PerplexityBot", `${SITE_CONFIG.siteUrl}/sitemap.xml`]) {
  if (!robots.includes(required)) errors.push(`robots.txt: missing ${required}`);
}

const feed = await fs.readFile(path.join(siteDir, "feed.xml"), "utf8");
if (!feed.includes('<feed xmlns="http://www.w3.org/2005/Atom">')) errors.push("feed.xml: invalid Atom root");
const indexNowPath = path.join(siteDir, `${SITE_CONFIG.indexNowKey}.txt`);
const indexNowKey = (await fs.readFile(indexNowPath, "utf8")).trim();
if (indexNowKey !== SITE_CONFIG.indexNowKey) errors.push("IndexNow key file does not match site configuration");

if (errors.length) {
  console.error(`SEO audit failed with ${errors.length} issue${errors.length === 1 ? "" : "s"}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`SEO audit passed: ${htmlFiles.length} pages, ${sitemapSet.size} sitemap URLs, valid metadata, links, schema, feed, robots, and IndexNow key.`);
