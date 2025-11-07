#!/usr/bin/env node

const { execSync } = require("node:child_process");
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join, dirname } = require("node:path");

const LOCKFILE = "package-lock.json";
const HASH_PATH = join("node_modules", ".package-lock.hash");

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

const needsInstall = !hasNodeModules || !lockHash || existingHash !== lockHash;

if (!needsInstall) {
  console.log("node_modules already present and lockfile unchanged, skipping install.");
  process.exit(0);
}

const run = (command) => {
  execSync(command, { stdio: "inherit" });
};

try {
  console.log("Running npm ci…");
  run("npm ci");
} catch (error) {
  console.warn("npm ci failed, falling back to npm install.");
  run("npm install");
}

if (lockHash) {
  mkdirSync(dirname(HASH_PATH), { recursive: true });
  writeFileSync(HASH_PATH, `${lockHash}\n`, "utf8");
}
