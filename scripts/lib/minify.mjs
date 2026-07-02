import { createHash } from "node:crypto";

export function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>+~])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

export function minifyJs(js) {
  return js
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentHash(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 10);
}
