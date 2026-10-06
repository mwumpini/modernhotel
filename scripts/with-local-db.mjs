import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (!process.env.SQLITE_DATABASE_URL) {
  const db = path.join(root, 'prisma', 'test.db').replace(/\\/g, '/')
  process.env.SQLITE_DATABASE_URL = `file:${db}`
}

const [command, ...args] = process.argv.slice(2)
if (!command) {
  console.error('Usage: node scripts/with-local-db.mjs <command> [args...]')
  process.exit(1)
}

const result = spawnSync(command, args, {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
