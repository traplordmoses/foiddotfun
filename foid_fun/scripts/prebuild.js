#!/usr/bin/env node

const { execSync } = require("node:child_process");
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join, dirname } = require("node:path");

const PNPM_LOCK = "pnpm-lock.yaml";
const NPM_LOCK = "package-lock.json";
const hasPnpmLock = existsSync(PNPM_LOCK);
const hasNpmLock = existsSync(NPM_LOCK);
const usingPnpm = hasPnpmLock;
const LOCKFILE = usingPnpm ? PNPM_LOCK : hasNpmLock ? NPM_LOCK : null;
const HASH_PATH = join(
  "node_modules",
  usingPnpm ? ".pnpm-lock.hash" : ".npm-lock.hash"
);
const installCmd = usingPnpm
  ? "corepack enable && pnpm install --frozen-lockfile"
  : "npm ci";

const getMissingDeps = () => {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const deps = Object.keys(pkg.dependencies || {});
    return deps.filter((dep) => !existsSync(join("node_modules", dep)));
  } catch {
    return [];
  }
};

const getLockHash = () => {
  if (!LOCKFILE) return null;
  const contents = readFileSync(LOCKFILE);
  return createHash("sha256").update(contents).digest("hex");
};

if (!LOCKFILE) {
  console.error("No lockfile found (pnpm-lock.yaml or package-lock.json).");
  process.exit(1);
}

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

if (!lockHash) {
  console.error(`Missing lockfile: ${LOCKFILE}`);
  process.exit(1);
}

const runInstall = (reason) => {
  if (reason) {
    console.log(reason);
  }
  console.log(`Installing dependencies via "${installCmd}"...`);
  execSync(installCmd, { stdio: "inherit" });
};

if (!hasNodeModules) {
  runInstall("node_modules missing.");
} else if (!existingHash || existingHash !== lockHash) {
  runInstall("Lockfile changed or hash missing.");
} else {
  const missingDeps = getMissingDeps();
  if (missingDeps.length > 0) {
    runInstall(`Missing dependencies: ${missingDeps.slice(0, 6).join(", ")}.`);
  } else {
    console.log("node_modules already present and lockfile unchanged, skipping install.");
  }
}

mkdirSync(dirname(HASH_PATH), { recursive: true });
writeFileSync(HASH_PATH, `${lockHash}\n`, "utf8");
console.log(`Recorded ${LOCKFILE} hash.`);
