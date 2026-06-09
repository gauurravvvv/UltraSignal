/**
 * Cross-platform replacement for the old shell-based copy-files step.
 *
 * What it does:
 *   - copies ./public/ → ./dist/public/   (recursive, if ./public exists)
 *   - copies ./.env    → ./dist/.env      (if .env exists)
 *
 * No external dependencies; uses only Node built-ins. Works on Windows,
 * macOS, and Linux identically. Run via:  node scripts/copy-files.js
 */
const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
  return true;
}

function copyFileIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

const ROOT = process.cwd();
const publicCopied = copyDirSync(
  path.join(ROOT, 'public'),
  path.join(ROOT, 'dist', 'public'),
);
const envCopied = copyFileIfExists(
  path.join(ROOT, '.env'),
  path.join(ROOT, 'dist', '.env'),
);

console.log(
  `copy-files: public=${publicCopied ? 'copied' : 'skipped (missing)'}, ` +
    `.env=${envCopied ? 'copied' : 'skipped (missing)'}`,
);
