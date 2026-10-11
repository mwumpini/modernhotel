/** One journal series for accounting expenses and till petty expenses. */
export function nextJournalEntryNumber(entryNumbers: string[], occupiedCount = 0): string {
  const year = new Date().getFullYear()
  const prefix = `JE-${year}-`
  let highest = 0
  for (const raw of entryNumbers) {
    if (!raw?.startsWith(prefix)) continue
    const seq = Number(raw.slice(prefix.length))
    if (Number.isInteger(seq) && seq > highest) highest = seq
  }
  const next = Math.max(highest, occupiedCount) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

/**
 * Browser side: ask the server for the hotel's next journal number (one at a time, never a
 * duplicate). If the server cannot be reached, fall back to counting what this screen has.
 */
export async function takeJournalEntryNumber(localEntryNumbers: string[]): Promise<string> {
  try {
    const { getClientTenantSubdomain } = await import('../api/clientTenant')
    const res = await fetch('/api/accounting/journal-numbers', {
      method: 'POST',
      headers: { 'x-tenant-subdomain': getClientTenantSubdomain() || '' },
    })
    if (res.ok) {
      const body = await res.json()
      if (typeof body.entryNumber === 'string' && body.entryNumber) return body.entryNumber
    }
  } catch {
    // offline: fall through
  }
  return nextJournalEntryNumber(localEntryNumbers, localEntryNumbers.length)
}
