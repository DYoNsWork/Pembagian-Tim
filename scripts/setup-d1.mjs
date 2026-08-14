import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const DB_NAME = "pembagian-tim-db";
const CONFIG_PATH = new URL("../wrangler.jsonc", import.meta.url);

function run(command) {
  return execSync(command, { encoding: "utf8" });
}

function extractId(text) {
  const match = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : null;
}

function readExistingId(listOutput) {
  const lines = listOutput.split("\n");
  const row = lines.find((line) => line.includes(DB_NAME));
  return row ? extractId(row) : null;
}

let databaseId;

try {
  const created = run(`npx wrangler d1 create ${DB_NAME}`);
  console.log(created);
  databaseId = extractId(created);
} catch (error) {
  const message = `${error.stdout || ""}\n${error.stderr || ""}\n${error.message || ""}`;
  if (!/already exists|duplicate/i.test(message)) {
    throw error;
  }
  console.log(`Database ${DB_NAME} sudah ada. Mengambil ID-nya…`);
  databaseId = readExistingId(run("npx wrangler d1 list"));
}

if (!databaseId) {
  throw new Error(
    "Tidak menemukan database_id. Buat D1 di dashboard Cloudflare, lalu tempel ID-nya ke wrangler.jsonc.",
  );
}

const config = readFileSync(CONFIG_PATH, "utf8");
const updated = config.replace(
  /"database_id":\s*"[^"]+"/,
  `"database_id": "${databaseId}"`,
);
writeFileSync(CONFIG_PATH, updated);

console.log(`database_id disimpan: ${databaseId}`);
console.log("Berikutnya: git add wrangler.jsonc && git commit && git push");
console.log("Lalu jalankan: npm run db:migrate:remote");
