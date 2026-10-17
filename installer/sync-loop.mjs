const port = process.env.PORT || '3000'

async function tick() {
  try {
    await fetch(`http://127.0.0.1:${port}/api/sync/tick`, { method: 'POST' })
  } catch {
    // The hotel server is still starting, or the internet path is not linked yet.
  }
}

setInterval(tick, 15000)
tick()
