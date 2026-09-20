#!/usr/bin/env node

// Installation is an explicit deployment/CI step. Never replace the active
// package manager or make a second network install from a build lifecycle hook.
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

if (!existsSync("pnpm-lock.yaml")) {
  console.error("Missing pnpm-lock.yaml. Build from the foid_fun directory.");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const missing = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  .filter((dependency) => !existsSync(join("node_modules", dependency)));
if (missing.length) {
  console.error(`Missing dependencies: ${missing.slice(0, 6).join(", ")}. Run pnpm install --frozen-lockfile before building.`);
  process.exit(1);
}
console.log("Build dependencies are installed.");
