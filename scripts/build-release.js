const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const CLIENT_DIST = path.join(DIST, "client");

const IGNORE_NAMES = new Set([
  ".git",
  ".github",
  ".idea",
  ".vscode",
  ".cursor",
  "node_modules",
  "dist",
  "tests",
  "VFX_LAB",
  "scripts"
]);

const IGNORE_PREFIXES = [
  ".edge-headless-profile"
];

const IGNORE_FILES = new Set([
  "package-lock.json",
  "stop-server.js",
  "server.js"
]);

function shouldIgnore(name) {
  if (IGNORE_NAMES.has(name)) return true;
  if (IGNORE_FILES.has(name)) return true;
  return IGNORE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function ensureCleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyTree(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldIgnore(entry.name)) continue;
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(src, dst);
      continue;
    }
    fs.copyFileSync(src, dst);
  }
}

function writeReleaseReadme() {
  const readmePath = path.join(CLIENT_DIST, "RELEASE_NOTES.txt");
  const lines = [
    "VoidFront release bundle",
    "",
    "This directory contains the static client payload only.",
    "Server/runtime files, tests, VFX experiments, and local browser artifacts are excluded."
  ];
  fs.writeFileSync(readmePath, lines.join("\n") + "\n", "utf8");
}

function writeRuntimeConfig() {
  const configPath = path.join(CLIENT_DIST, "runtime-config.js");
  const content = [
    "(function () {",
    "  \"use strict\";",
    "  if (typeof window === \"undefined\") return;",
    "  window.__VOIDFRONT_RUNTIME_CONFIG = Object.assign({}, window.__VOIDFRONT_RUNTIME_CONFIG || {}, {",
    "    serverUrl: null,",
    "    authorityMode: \"host-client\",",
    "    releaseChannel: \"production\",",
    "    enableDebugTools: false,",
    "    enablePerfHud: false,",
    "    enableTestUi: false,",
    "    yandexSdkEnabled: true",
    "  });",
    "})();",
    ""
  ].join("\n");
  fs.writeFileSync(configPath, content, "utf8");
}

ensureCleanDir(DIST);
copyTree(ROOT, CLIENT_DIST);
writeReleaseReadme();
writeRuntimeConfig();

console.log(`Release client bundle created at ${CLIENT_DIST}`);
