import { execSync } from "node:child_process";

if (process.env.WORKERS_CI !== "1") {
  process.exit(0);
}

console.log("Workers CI terdeteksi: membangun aset sebelum wrangler deploy…");
execSync("npm run build && node scripts/sync-d1.mjs", { stdio: "inherit" });
