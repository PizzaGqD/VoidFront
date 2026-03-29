const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const CLIENT_DIST = path.join(DIST, "client");
const BUILD_YANDEX = process.argv.includes("--yandex");
const CREATE_ZIP = process.argv.includes("--zip");
const ZIP_NAME = BUILD_YANDEX ? "voidfront-yandex-upload.zip" : "voidfront-single-release.zip";
const ZIP_PATH = path.join(DIST, ZIP_NAME);
const YANDEX_MUSIC_PLAYLIST = [
  "Cold Orbit Command (2).mp3",
  "Gravitational Echoes.mp3",
  "Hello void.mp3",
  "Last step to the stars.mp3",
  "VOID.mp3"
];

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
  "server.js",
  "net.js",
  "snapshot-sync.js",
  "socket-action-dispatch.js",
  "match-session.js",
  "socket-session.js",
  "action-gateway.js",
  "authority-adapter.js",
  "runtime-observability.js",
  "lobby-ui.js",
  "remote-client-runtime.js",
  "host-network-runtime.js",
  "test-mechanics.js"
]);

function shouldIgnore(name) {
  if (IGNORE_NAMES.has(name)) return true;
  if (IGNORE_FILES.has(name)) return true;
  return IGNORE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function shouldCopyFile(srcPath) {
  if (!BUILD_YANDEX) return true;
  const rel = path.relative(ROOT, srcPath).replace(/\\/g, "/");
  if (!rel.startsWith("assets/") || !/\.mp3$/i.test(rel)) return true;
  return YANDEX_MUSIC_PLAYLIST.includes(path.basename(srcPath));
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
    if (!entry.isDirectory() && !shouldCopyFile(src)) continue;
    fs.copyFileSync(src, dst);
  }
}

function writeReleaseReadme() {
  const readmePath = path.join(CLIENT_DIST, "RELEASE_NOTES.txt");
  const lines = [
    BUILD_YANDEX ? "VoidFront Yandex Games single-only bundle" : "VoidFront single-only release bundle",
    "",
    "This directory contains the static single-player client payload only.",
    "Multiplayer/network runtime files, tests, VFX experiments, and local browser artifacts are excluded.",
    BUILD_YANDEX ? "Yandex Games SDK support is enabled in this build." : "Yandex Games SDK support stays optional in this build."
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
    "    authorityMode: \"local\",",
    `    releaseChannel: ${JSON.stringify(BUILD_YANDEX ? "yandex-games" : "production")},`,
    "    enableDebugTools: false,",
    "    enablePerfHud: false,",
    "    enableTestUi: false,",
    `    yandexSdkEnabled: ${BUILD_YANDEX ? "true" : "false"},`,
    `    musicPlaylist: ${JSON.stringify(BUILD_YANDEX ? YANDEX_MUSIC_PLAYLIST : [])},`,
    "    singleOnly: true",
    "  });",
    "})();",
    ""
  ].join("\n");
  fs.writeFileSync(configPath, content, "utf8");
}

function createZipArchive() {
  fs.rmSync(ZIP_PATH, { force: true });
  if (process.platform === "win32") {
    childProcess.execFileSync("powershell", [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path "${CLIENT_DIST.replace(/\\/g, "\\\\")}\\*" -DestinationPath "${ZIP_PATH.replace(/\\/g, "\\\\")}" -Force`
    ], { stdio: "inherit" });
    return;
  }
  childProcess.execFileSync("zip", ["-qr", ZIP_PATH, "."], {
    cwd: CLIENT_DIST,
    stdio: "inherit"
  });
}

ensureCleanDir(DIST);
copyTree(ROOT, CLIENT_DIST);
writeReleaseReadme();
writeRuntimeConfig();
if (CREATE_ZIP) createZipArchive();

console.log(`Release client bundle created at ${CLIENT_DIST}`);
if (CREATE_ZIP) console.log(`Upload archive created at ${ZIP_PATH}`);
