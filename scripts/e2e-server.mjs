/**
 * Starts the app for the end-to-end tests on its own copy of everything:
 *   database  prisma/e2e.db   (recreated each run, then seeded: Demo Hotel + Rival Lodge)
 *   build     .next-e2e       (never the .next folder a dev server is using)
 *   port      3100
 * Playwright runs this as its web server (see playwright.config.ts).
 * Set E2E_REUSE_BUILD=1 to skip the build when .next-e2e already holds one.
 */
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbFile = path.join(root, 'prisma', 'e2e.db');
const port = process.env.E2E_PORT || '3100';
const distDir = '.next-e2e';

const env = {
  ...process.env,
  SQLITE_DATABASE_URL: `file:${dbFile.replace(/\\/g, '/')}`,
  NEXT_DIST_DIR: distDir,
  NEXTAUTH_URL: `http://localhost:${port}`,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'e2e-test-secret-not-for-production',
  NEXT_PUBLIC_DEMO_MODE: 'false',
  NEXT_TELEMETRY_DISABLED: '1',
};

function run(label, command, args) {
  console.log(`[e2e] ${label}`);
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`[e2e] ${label} failed`);
    process.exit(result.status ?? 1);
  }
}

for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(dbFile + suffix, { force: true });
// CI built the cloud (Postgres) client first; switch it back. Locally the SQLite client is
// already in place, and regenerating it while a dev server runs fails on Windows (file in use).
if (process.env.CI) run('Generate the local (SQLite) database client', 'npx', ['prisma', 'generate', '--schema', 'prisma/schema.prisma']);
run('Create a fresh test database', 'npx', ['prisma', 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate']);
run('Seed Demo Hotel', 'npx', ['tsx', 'prisma/seed.ts']);
run('Seed Rival Lodge', 'npx', ['tsx', 'tests/e2e/seed-rival.ts']);

const reuse = process.env.E2E_REUSE_BUILD === '1' && existsSync(path.join(root, distDir, 'BUILD_ID'));
if (!reuse) run('Build the app into .next-e2e', 'npx', ['next', 'build']);

console.log(`[e2e] Starting on http://localhost:${port}`);
const server = spawn('npx', ['next', 'start', '-p', port], { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
const stop = () => server.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));
