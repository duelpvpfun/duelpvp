// Local-only: convert the Phantom base58 secret key in .env into a Solana
// keypair JSON written OUTSIDE the repo. The key never touches git or chat.
//
// Usage:
//   1. Put PHANTOM_PRIVATE_KEY=<base58> in .env (gitignored)
//   2. node scripts/import-phantom-key.mjs

import { writeFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import bs58 from "bs58";

const OUT = join(homedir(), ".config", "solana", "mainnet-authority.json");

// Minimal .env parser (avoids extra deps).
function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    console.error("No .env file found. Copy .env.example to .env first.");
    process.exit(1);
  }
  return env;
}

const env = loadEnv();
const b58 = (env.PHANTOM_PRIVATE_KEY || "").trim();
if (!b58) {
  console.error("PHANTOM_PRIVATE_KEY is empty in .env");
  process.exit(1);
}

let secret;
try {
  secret = bs58.decode(b58);
} catch {
  console.error("Could not base58-decode PHANTOM_PRIVATE_KEY.");
  process.exit(1);
}
if (secret.length !== 64) {
  console.error(`Expected 64-byte secret key, got ${secret.length} bytes.`);
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify(Array.from(secret)));
console.log("Wrote keypair to: " + OUT);
