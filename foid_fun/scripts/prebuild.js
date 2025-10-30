#!/usr/bin/env node

const { execSync } = require("node:child_process");
const { existsSync } = require("node:fs");

const hasNodeModules = existsSync("node_modules");

if (hasNodeModules) {
  console.log("node_modules already present, skipping install.");
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
