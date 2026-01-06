#!/usr/bin/env node

const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join, dirname } = require("node:path");

const LOCKFILE = "pnpm-lock.yaml";
const HASH_PATH = join("node_modules", ".pnpm-lock.hash");

const getLockHash = () => {
  if (!existsSync(LOCKFILE)) return null;
  const contents = readFileSync(LOCKFILE);
  return createHash("sha256").update(contents).digest("hex");
};

const lockHash = getLockHash();
const hasNodeModules = existsSync("node_modules");
let existingHash = null;

if (hasNodeModules && existsSync(HASH_PATH)) {
  try {
    existingHash = readFileSync(HASH_PATH, "utf8").trim();
  } catch {
    existingHash = null;
  }
}

if (!hasNodeModules) {
  console.error("node_modules missing. Run pnpm install before building.");
  process.exit(1);
}

if (!lockHash) {
  console.error("pnpm-lock.yaml missing. Run pnpm install to generate it.");
  process.exit(1);
}

if (existingHash && existingHash === lockHash) {
  console.log("node_modules already present and lockfile unchanged, skipping install.");
  process.exit(0);
}

mkdirSync(dirname(HASH_PATH), { recursive: true });
writeFileSync(HASH_PATH, `${lockHash}\n`, "utf8");
console.log("Recorded pnpm lockfile hash. Skipping install during prebuild.");
