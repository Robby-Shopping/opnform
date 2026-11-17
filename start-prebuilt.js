// start.js - runs a PREBUILT OpnForm client (built by GitHub Actions).
// Set the egg's main/JS file to "start.js" and leave the Git address EMPTY.
// No npm install / build happens on the server, so RAM needs are minimal.

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

// ====================== EDIT THESE ======================
const API_BASE_URL = "https://forms.robbyshopping.com/api"; // public URL of your OpnForm Laravel API
const RELEASE_URL =
  "https://github.com/Robby-Shopping/opnform/releases/download/latest/opnform-client.tar.gz";
const FORCE_UPDATE = false; // true = re-download on next start (set back to false afterwards)
// ========================================================

const ROOT = "/home/container";
const APP_DIR = path.join(ROOT, "opnform");
const ENTRY = path.join(APP_DIR, ".output", "server", "index.mjs");
const TARBALL = path.join(ROOT, "opnform-client.tar.gz");
const PORT = process.env.SERVER_PORT || process.env.PORT || "3000";

async function download(url, dest) {
  console.log(`Downloading ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest));
}

async function main() {
  if (FORCE_UPDATE || !fs.existsSync(ENTRY)) {
    await download(RELEASE_URL, TARBALL);
    fs.rmSync(APP_DIR, { recursive: true, force: true });
    fs.mkdirSync(APP_DIR, { recursive: true });
    const r = spawnSync("tar", ["-xzf", TARBALL, "-C", APP_DIR], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("Extraction failed");
    fs.rmSync(TARBALL, { force: true });
  }

  if (!fs.existsSync(ENTRY)) throw new Error(`Not found: ${ENTRY}`);

  console.log(`Starting OpnForm client on port ${PORT} ...`);
  const child = spawn("node", [ENTRY], {
    cwd: APP_DIR,
    stdio: "inherit",
    env: {
      ...process.env,
      NITRO_HOST: "0.0.0.0",
      NITRO_PORT: PORT,
      PORT: PORT,
      NUXT_PUBLIC_API_BASE: API_BASE_URL,
      NUXT_API_BASE: API_BASE_URL,
    },
  });
  child.on("exit", (code) => process.exit(code || 0));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  process.on("SIGINT", () => child.kill("SIGINT"));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
