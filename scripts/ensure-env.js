/**
 * ensure-env.js
 * Runs before every start/build (pre* npm hooks).
 * If .env is missing, it is created from .env.example so a fresh clone
 * boots with `npm run start:dev` and zero manual setup.
 * Skipped in production — platform env vars are the source of truth there.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
  process.exit(0);
}

if (!fs.existsSync(envPath)) {
  if (!fs.existsSync(examplePath)) {
    console.error('[ensure-env] .env.example not found — cannot bootstrap .env');
    process.exit(1);
  }
  fs.copyFileSync(examplePath, envPath);
  console.log('[ensure-env] .env created from .env.example — fill in secrets before hitting protected features.');
} 
