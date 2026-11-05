import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationDir = resolve(root, "supabase/migrations");
const migrationFiles = (await readdir(migrationDir)).filter((name) => name.endsWith(".sql")).sort();
if (!migrationFiles.length) throw new Error("Tidak ada migration SQL untuk digabungkan.");

const sections = [
  "-- MUTABA'AH one-time setup for a brand-new Supabase project.\n-- Review the project ref before running. Do not run this bundle twice.\n-- This bundle applies schema, policies, triggers, RPCs, private photo storage,\n-- reporting functions and write guards.\n\nBEGIN;\n",
];

for (const filename of migrationFiles) {
  sections.push(`\n\n-- ===== BEGIN ${filename} =====\n`);
  sections.push(await readFile(resolve(migrationDir, filename), "utf8"));
  sections.push(`\n-- ===== END ${filename} =====\n`);
}
sections.push("\nCOMMIT;\n");

await writeFile(resolve(root, "supabase/setup.sql"), sections.join(""), "utf8");
process.stdout.write(`Generated supabase/setup.sql from ${migrationFiles.length} migrations.\n`);
