import { spawn, execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const PORT = 3000
const appDir = path.join(root, 'app')
const nodeExe = path.join(root, 'node', 'node.exe')
const schemaPath = path.join(appDir, 'prisma', 'schema.prisma')
const prismaCli = path.join(root, 'prisma-cli', 'node_modules', 'prisma', 'build', 'index.js')
const templateDb = path.join(root, 'template.db')

function sqliteFileUrl(filePath) {
  return `file:${path.resolve(filePath).replace(/\\/g, '/')}`
}

function dataDir() {
  const preferred = path.join(process.env.ProgramData || 'C:\\ProgramData', 'GhanaHotel')
  try {
    fs.mkdirSync(preferred, { recursive: true })
    const probe = path.join(preferred, '.write-test')
    fs.writeFileSync(probe, 'ok')
    fs.rmSync(probe, { force: true })
    return preferred
  } catch {
    const local = path.join(root, 'data')
    fs.mkdirSync(local, { recursive: true })
    return local
  }
}

function lanAddress() {
  const found = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      const family = net.family
      if (net.internal) continue
      if (family !== 'IPv4' && family !== 4) continue
      if (net.address.startsWith('169.254.')) continue
      found.push(net.address)
    }
  }
  const preferred = found.find((ip) =>
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  )
  return preferred || found[0] || null
}

function hotelUrl() {
  const host = lanAddress() || '127.0.0.1'
  return `http://${host}:${PORT}`
}

function readEnvFile(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line)
    if (match) out[match[1]] = match[2]
  }
  return out
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readPid(pidFile) {
  if (!fs.existsSync(pidFile)) return null
  const pid = Number(fs.readFileSync(pidFile, 'utf8').trim())
  return Number.isInteger(pid) ? pid : null
}

function stopServer(dir) {
  const pidFile = path.join(dir, 'server.pid')
  const pid = readPid(pidFile)
  if (!pid || !pidAlive(pid)) {
    fs.rmSync(pidFile, { force: true })
    console.log('The hotel system is not running.')
    return
  }
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } catch {
    // The process may already have exited.
  }
  fs.rmSync(pidFile, { force: true })
  console.log('The hotel system has stopped. Other computers cannot open it until you start it again.')
}

function openBrowser(url) {
  spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    const done = (open) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(400)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

async function waitUntilReady(port) {
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return false
}

const records = dataDir()

const background = process.argv.includes('--background')

if (process.argv.includes('--check')) {
  console.log(`Address: ${hotelUrl()}`)
  console.log(`Records: ${records}`)
  process.exit(0)
}

if (process.argv.includes('--stop')) {
  stopServer(records)
  process.exit(0)
}

if (process.argv.includes('--open')) {
  const urlFile = path.join(records, 'url.txt')
  if (!fs.existsSync(urlFile)) {
    console.log('The hotel system is not running. Double-click Start Hotel System first.')
    process.exit(1)
  }
  openBrowser(hotelUrl())
  process.exit(0)
}

if (!fs.existsSync(path.join(appDir, 'server.js')) || !fs.existsSync(nodeExe)) {
  console.log('This copy is incomplete. On the hotel PC, run Install Hotel System from the built package.')
  process.exit(1)
}

const pidFile = path.join(records, 'server.pid')
const existingPid = readPid(pidFile)
if (existingPid && pidAlive(existingPid)) {
  const url = fs.existsSync(path.join(root, 'sync-mode.txt')) && fs.existsSync(path.join(records, 'sync.json'))
    ? (() => {
        try {
          const saved = JSON.parse(fs.readFileSync(path.join(records, 'sync.json'), 'utf8'))
          return saved.token ? hotelUrl() : `${hotelUrl()}/sync`
        } catch {
          return `${hotelUrl()}/sync`
        }
      })()
    : hotelUrl()
  fs.writeFileSync(path.join(records, 'url.txt'), url, 'utf8')
  console.log('The hotel system is already running.')
  console.log(url)
  if (!background) openBrowser(url)
  process.exit(0)
}

const envFile = path.join(records, 'server.env')
const saved = readEnvFile(envFile)
const secret = saved.NEXTAUTH_SECRET || crypto.randomBytes(32).toString('hex')
fs.writeFileSync(envFile, `NEXTAUTH_SECRET=${secret}\r\nPORT=${PORT}\r\n`, 'utf8')

const dbFile = path.join(records, 'hotel.db')
const firstDatabase = !fs.existsSync(dbFile)
if (firstDatabase) {
  if (!fs.existsSync(templateDb)) {
    console.log('The starting hotel records are missing from this install.')
    process.exit(1)
  }
  fs.copyFileSync(templateDb, dbFile)
}

if (fs.existsSync(prismaCli)) {
  console.log('Checking the hotel records...')
  const push = spawn(nodeExe, [prismaCli, 'db', 'push', '--schema', schemaPath, '--skip-generate'], {
    cwd: appDir,
    env: { ...process.env, SQLITE_DATABASE_URL: sqliteFileUrl(dbFile), CI: '1' },
    stdio: 'inherit',
  })
  const pushCode = await new Promise((resolve) => push.on('exit', resolve))
  if (pushCode !== 0 && !fs.existsSync(dbFile)) {
    console.log('Could not create the hotel database.')
    process.exit(1)
  }
  if (pushCode !== 0) {
    console.log('Could not update the database shape. Starting with the records already on this PC.')
  }
}

const publicUrl = hotelUrl()
const syncing = fs.existsSync(path.join(root, 'sync-mode.txt'))
const syncFile = path.join(records, 'sync.json')
let syncConfig = {}
if (syncing) {
  try {
    if (fs.existsSync(syncFile)) syncConfig = JSON.parse(fs.readFileSync(syncFile, 'utf8'))
  } catch {
    syncConfig = {}
  }
  if (!syncConfig.nodeId) {
    syncConfig.nodeId = `premises-${crypto.randomBytes(8).toString('hex')}`
    fs.writeFileSync(syncFile, JSON.stringify(syncConfig, null, 2), 'utf8')
  }
}
function browserUrl() {
  if (syncing && !syncConfig.token) return `${publicUrl}/sync`
  return publicUrl
}
fs.writeFileSync(path.join(records, 'url.txt'), browserUrl(), 'utf8')
fs.writeFileSync(pidFile, String(process.pid), 'utf8')

const clearPid = () => fs.rmSync(pidFile, { force: true })
process.on('exit', clearPid)

console.log('')
console.log('AGM Sync is the hotel server on this computer.')
console.log(`Other devices on this Wi-Fi open: ${publicUrl}`)
console.log('This computer must stay on.')
console.log(syncing
  ? 'While the internet is up, this computer and the cloud keep the same records.'
  : 'The internet can be down.')
if (firstDatabase) {
  console.log('')
  console.log('First sign-in')
  console.log('Hotel code: demo')
  console.log('Email: admin@demohotel.com')
  console.log('Password: password123')
  console.log('Change this password after you sign in.')
}
console.log('')

const child = spawn(nodeExe, ['server.js'], {
  cwd: appDir,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    HOSTNAME: '0.0.0.0',
    SQLITE_DATABASE_URL: sqliteFileUrl(dbFile),
    AUTH_TRUST_HOST: 'true',
    NEXTAUTH_URL: publicUrl,
    NEXTAUTH_SECRET: secret,
    NEXT_TELEMETRY_DISABLED: '1',
    CLOUD_SYNC_MODE: syncing ? '1' : '',
    CLOUD_SYNC_CONFIG: syncFile,
  },
  stdio: 'inherit',
})

const ready = await waitUntilReady(PORT)
if (ready && syncing) {
  spawn(nodeExe, [path.join(root, 'sync-loop.mjs')], {
    env: { ...process.env, PORT: String(PORT) },
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref()
}
if (ready && !background) openBrowser(browserUrl())
else if (!ready) console.log(`The window did not open by itself. Open ${browserUrl()} in a browser.`)

const code = await new Promise((resolve) => {
  child.on('exit', resolve)
})
process.exit(code ?? 0)
