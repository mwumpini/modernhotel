#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const dirs = ['.next'];
for (const d of dirs) {
  const p = path.join(process.cwd(), d);
  if (fs.existsSync(p)) {
    try {
      fs.rmSync(p, { recursive: true, force: true });
      console.log('Removed', d);
    } catch (e) {
      console.error('Failed to remove', d, e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }
  }
}
