#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rmDir(p) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      return true;
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(300 * (attempt + 1));
    }
  }
  return false;
}

const dirs = ['.next'];
for (const d of dirs) {
  const p = path.join(process.cwd(), d);
  if (fs.existsSync(p)) {
    try {
      await rmDir(p);
      console.log('Removed', d);
    } catch (e) {
      console.error('Failed to remove', d, e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }
  }
}
