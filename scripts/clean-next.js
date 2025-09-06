#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dirs = ['.next'];
for (const d of dirs) {
  const p = path.join(process.cwd(), d);
  if (fs.existsSync(p)) {
    try {
      fs.rmSync(p, { recursive: true, force: true });
      console.log('Removed', d);
    } catch (e) {
      console.error('Failed to remove', d, e.message);
    }
  }
}


