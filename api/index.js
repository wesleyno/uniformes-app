// Vercel serverless entry point (ESM)
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const { default: app, appReady } = require(join(__dirname, '../dist/app.cjs'));

let initialized = false;

export default async function handler(req, res) {
  if (!initialized) {
    await appReady;
    initialized = true;
  }
  return app(req, res);
}
