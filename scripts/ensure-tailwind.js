#!/usr/bin/env node
const path = require('path');
const { createRequire } = require('module');

function canResolve() {
  try {
    require.resolve('@tailwindcss/postcss', { paths: [process.cwd()] });
    return true;
  } catch {}
  try {
    const cr = createRequire(path.join(process.cwd(), 'package.json'));
    cr.resolve('@tailwindcss/postcss');
    return true;
  } catch {}
  try {
    // pnpm virtual store fallback (best-effort, version-agnostic)
    const store = path.join(process.cwd(), 'node_modules/.pnpm');
    const candidate = require('fs')
      .readdirSync(store)
      .find((d) => d.startsWith('@tailwindcss+postcss@'));
    if (candidate) {
      require.resolve(path.join(store, candidate, 'node_modules/@tailwindcss/postcss'));
      return true;
    }
  } catch {}
  return false;
}

if (!canResolve()) {
  console.error('\nTailwind PostCSS plugin missing. Please run:');
  console.error('  npm install -D @tailwindcss/postcss@4.1.13  OR  pnpm add -D @tailwindcss/postcss@4.1.13');
  process.exit(1);
}

process.exit(0);


