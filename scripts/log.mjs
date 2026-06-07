import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const logsFile = path.join(rootDir, "content", "logs.md");

const message = process.argv.slice(2).join(" ").trim();
if (!message) {
  console.error("usage: npm run log -- \"your message here\"");
  process.exit(1);
}

const now = new Date();
const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
const timestamp = `${date} · ${time}`;

const entry = `## ${timestamp}\n${message}\n\n`;

let existing = "";
try {
  existing = await fs.readFile(logsFile, "utf8");
} catch {
  // file doesn't exist yet
}

await fs.writeFile(logsFile, entry + existing, "utf8");
console.log(`logged: ${timestamp}`);

execSync("npm run build", { cwd: rootDir, stdio: "inherit" });
