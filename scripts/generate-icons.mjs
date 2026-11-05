import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "public/icons/mutabaah-icon.svg");
for (const [filename, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["maskable-512.png", 512]]) {
  await sharp(source).resize(size, size).png().toFile(resolve(root, "public/icons", filename));
}
