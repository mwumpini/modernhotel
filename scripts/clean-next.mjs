#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
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

const dirs = [
  '.next',
  path.join(os.tmpdir(), 'ghana-hotel-next-cache'),
];

for (const d of dirs) {
  const p = path.isAbsolute(d) ? d : path.join(process.cwd(), d);
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
