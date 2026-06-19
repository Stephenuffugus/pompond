#!/usr/bin/env node
/* Pom Pond build — lean, no bundler. Inlines the local-first core modules
   (store + critter-engine + economy + app) into src/shell.html and writes
   public/index.html. The Firebase layer (js/cloud.js) stays a separate,
   deploy-only module and is NOT inlined, so the jsdom harness (which loads
   the built index.html with no network) runs pure local mode and stays green.

   Usage: node build.mjs   ->   public/index.html
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

// Order matters: store + engine + economy must be defined before app runs.
const ORDER = ['store.js', 'critter-engine.js', 'economy.js', 'app.js'];
const core = ORDER.map(f => `\n/* ===== src/${f} ===== */\n` + src(f)).join('\n');

const shell = src('shell.html');
if (!shell.includes('/*__INJECT_CORE__*/')) {
  console.error('build: marker /*__INJECT_CORE__*/ not found in shell.html');
  process.exit(1);
}
const out = shell.replace('/*__INJECT_CORE__*/', () => core);

const dest = path.join(__dirname, 'public', 'index.html');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log(`build: wrote ${path.relative(__dirname, dest)} (${(out.length/1024).toFixed(1)} KB)`);

// Keep ONE source of truth for the deterministic engine + economy: src/.
// Sync them into the Cloud Functions package so the server runs identical math.
const sharedDir = path.join(__dirname, 'functions', 'shared');
fs.mkdirSync(sharedDir, { recursive: true });
for (const f of ['critter-engine.js', 'economy.js']) {
  fs.copyFileSync(path.join(__dirname, 'src', f), path.join(sharedDir, f));
}
console.log('build: synced shared modules -> functions/shared/');
