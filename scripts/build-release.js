"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { build } = require("esbuild");

async function main() {
  const rootDir = path.resolve(__dirname, "..");
  const outDir = path.join(rootDir, "release", "format");
  const outfile = path.join(outDir, "main.js");

  fs.mkdirSync(outDir, { recursive: true });

  await build({
    entryPoints: [path.join(rootDir, "main.js")],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: ["node18"],
    outfile,
    external: ["obsidian"],
    logLevel: "info",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
