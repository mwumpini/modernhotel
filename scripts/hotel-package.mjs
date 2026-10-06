import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dest = path.join(root, 'dist', 'GhanaHotel')
const installerDir = path.join(root, 'installer')

function sqliteFileUrl(filePath) {
  return `file:${path.resolve(filePath).replace(/\\/g, '/')}`
}

function run(command, args, extraEnv = {}, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} ${args.join(' ')} exited ${result.status}`)
  }
}

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to, {
    recursive: true,
    force: true,
    filter: (source) => !source.includes('.tmp'),
  })
}

const devDb = sqliteFileUrl(path.join(root, 'prisma', 'test.db'))
const templateFile = path.join(dest, 'template.db')
const hotelDist = path.join(root, '.next-hotel')
const clientIndexPath = path.join(root, 'node_modules', '.prisma', 'client', 'index.js')
const clientReady = fs.existsSync(clientIndexPath) && fs.readFileSync(clientIndexPath, 'utf8').includes('SQLITE_DATABASE_URL')

if (!clientReady) {
  console.log('Preparing the local database client...')
  run(process.execPath, [path.join(root, 'scripts', 'with-local-db.mjs'), process.execPath, path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'generate'])
}

const standalone = path.join(hotelDist, 'standalone')
if (process.env.HOTEL_SKIP_BUILD === '1' && fs.existsSync(path.join(standalone, 'server.js'))) {
  console.log('Using the hotel server build already on disk.')
} else {
  console.log('Building the hotel server (this takes a few minutes)...')
  run(process.execPath, [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], {
    HOTEL_BUILD: '1',
    SQLITE_DATABASE_URL: devDb,
    NEXT_TELEMETRY_DISABLED: '1',
  })
}

if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  throw new Error('The build did not produce .next-hotel/standalone/server.js')
}

console.log('Assembling the install folder...')
fs.rmSync(dest, { recursive: true, force: true })
fs.mkdirSync(dest, { recursive: true })
fs.cpSync(standalone, path.join(dest, 'app'), { recursive: true })
copyIfExists(path.join(hotelDist, 'static'), path.join(dest, 'app', '.next', 'static'))
copyIfExists(path.join(root, 'public'), path.join(dest, 'app', 'public'))
copyIfExists(path.join(root, 'node_modules', '.prisma'), path.join(dest, 'app', 'node_modules', '.prisma'))
copyIfExists(path.join(root, 'node_modules', '@prisma', 'client'), path.join(dest, 'app', 'node_modules', '@prisma', 'client'))
fs.mkdirSync(path.join(dest, 'app', 'prisma'), { recursive: true })
fs.copyFileSync(path.join(root, 'prisma', 'schema.prisma'), path.join(dest, 'app', 'prisma', 'schema.prisma'))

console.log('Creating the starting hotel records...')
const templateUrl = sqliteFileUrl(templateFile)
run(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'db', 'push', '--skip-generate', '--accept-data-loss'], {
  SQLITE_DATABASE_URL: templateUrl,
  CI: '1',
})
run(process.execPath, [path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'prisma/seed.ts'], {
  SQLITE_DATABASE_URL: templateUrl,
  NODE_ENV: 'development',
})

const checkpoint = path.join(root, 'scripts', '.hotel-checkpoint.cjs')
fs.writeFileSync(checkpoint, `
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)')
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error)
    return prisma.$disconnect().finally(() => process.exit(1))
  })
`)
try {
  run(process.execPath, [checkpoint], { SQLITE_DATABASE_URL: templateUrl })
} finally {
  fs.rmSync(checkpoint, { force: true })
}
for (const suffix of ['-journal', '-wal', '-shm']) {
  fs.rmSync(templateFile + suffix, { force: true })
}

console.log('Adding the database update tool...')
const cliBuild = path.join(os.tmpdir(), 'ghana-hotel-prisma-cli')
fs.rmSync(cliBuild, { recursive: true, force: true })
fs.mkdirSync(cliBuild, { recursive: true })
const prismaVersion = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'prisma', 'package.json'), 'utf8')).version
fs.writeFileSync(path.join(cliBuild, 'package.json'), JSON.stringify({
  name: 'ghana-hotel-prisma-cli',
  private: true,
  dependencies: { prisma: prismaVersion },
}))
const npm = spawnSync('npm', ['install', '--omit=dev'], {
  cwd: cliBuild,
  stdio: 'inherit',
  shell: true,
})
if (npm.status !== 0) throw new Error('Could not download the database update tool')
fs.cpSync(cliBuild, path.join(dest, 'prisma-cli'), { recursive: true })

console.log('Copying the Windows runtime and installer...')
fs.mkdirSync(path.join(dest, 'node'), { recursive: true })
fs.copyFileSync(process.execPath, path.join(dest, 'node', 'node.exe'))
for (const name of fs.readdirSync(installerDir)) {
  if (name.endsWith('.iss') || name === 'after-install.txt') continue
  const from = path.join(installerDir, name)
  if (fs.statSync(from).isFile()) fs.copyFileSync(from, path.join(dest, name))
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
fs.writeFileSync(path.join(dest, 'version.txt'), `${pkg.version}\n`, 'utf8')
fs.writeFileSync(path.join(dest, 'INSTALL.txt'), `AGM Sync

1. Double-click "Install Hotel System.cmd"
2. Approve the Windows prompt
3. Leave the AGM Sync window open while the hotel is working
4. On this computer and on the other computers, open the address shown in that window

The internet can be down. This computer is the one that must stay on.
Hotel records stay in C:\\ProgramData\\GhanaHotel
`, 'utf8')

const isccCandidates = [
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
]
const iscc = isccCandidates.find((candidate) => fs.existsSync(candidate))
if (iscc) {
  console.log('Building Setup.exe...')
  run(iscc, [path.join(installerDir, 'GhanaHotel.iss')])
  console.log(`Setup program: ${path.join(root, 'dist', 'GhanaHotel-Setup.exe')}`)
  console.log('Building the staff setup...')
  run(iscc, [path.join(installerDir, 'GhanaHotelStaff.iss')])
  console.log(`Staff setup: ${path.join(root, 'dist', 'GhanaHotel-Staff-Setup.exe')}`)
} else {
  console.log('Inno Setup is not installed, so there is no single Setup.exe.')
  console.log('Copy dist\\GhanaHotel to the hotel computer and double-click "Install Hotel System.cmd".')
}

console.log(`Package ready: ${dest}`)
