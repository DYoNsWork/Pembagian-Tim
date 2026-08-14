import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLACEHOLDER = "00000000-0000-0000-0000-000000000001";

function extractDatabaseId(text) {
  const ids = [...text.matchAll(/"database_id"\s*:\s*"([^"]+)"/g)].map((match) => match[1]);
  const real = ids.find((id) => id && id !== PLACEHOLDER);
  return real || ids[0] || null;
}

function extractWorkerName(text) {
  const match = text.match(/"name"\s*:\s*"([^"]+)"/);
  return (match?.[1] || "pertandingan").replaceAll("-", "_");
}

const source = readFileSync(join(root, "wrangler.jsonc"), "utf8");
const databaseId = extractDatabaseId(source);
const workerDir = extractWorkerName(source);

if (!databaseId || databaseId === PLACEHOLDER) {
  console.error(
    "database_id di wrangler.jsonc masih placeholder. Isi UUID D1 produksi sebelum deploy.",
  );
  process.exit(1);
}

const generatedPath = join(root, "dist", workerDir, "wrangler.json");
const generated = JSON.parse(readFileSync(generatedPath, "utf8"));
const bindings = Array.isArray(generated.d1_databases) ? generated.d1_databases : [];

if (bindings.length === 0) {
  generated.d1_databases = [
    {
      binding: "DB",
      database_name: "pembagian-tim-db",
      database_id: databaseId,
    },
  ];
} else {
  for (const binding of bindings) {
    binding.database_id = databaseId;
  }
}

writeFileSync(generatedPath, `${JSON.stringify(generated, null, 2)}\n`);
console.log(`D1 database_id untuk deploy: ${databaseId}`);
