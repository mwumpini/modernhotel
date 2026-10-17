'use client';

import React from 'react';
import BrandLogo from '../components/BrandLogo';

type Status = {
  linked: boolean
  cloudUrl: string
  subdomain: string
  lastSync: string | null
  lastError: string | null
}

export default function SyncLinkPage() {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [cloudUrl, setCloudUrl] = React.useState('https://app.agmsync.com')
  const [subdomain, setSubdomain] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(() => {
    fetch('/api/sync/status')
      .then((response) => response.json())
      .then((data: Status) => {
        setStatus(data)
        if (data.cloudUrl) setCloudUrl(data.cloudUrl)
        if (data.subdomain) setSubdomain(data.subdomain)
      })
      .catch(() => setStatus(null))
  }, [])

  React.useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [load])

  const connect = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/sync/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudUrl, subdomain, email, password }),
      })
      const data = await response.json().catch(() => ({}))
      setMessage(data.error || (response.ok ? 'This computer and the cloud now share the same records.' : 'The link did not complete.'))
      load()
    } catch {
      setMessage('This computer could not reach the cloud.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B5F64] via-[#0E7C80] to-[#E9A23B] px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <BrandLogo size="md" />
        <h1 className="mt-6 text-xl font-semibold text-ghana-black">Link this computer to the cloud</h1>
        <p className="mt-2 text-sm text-gray-600">
          People at home and people in the hotel work on the same records. When the internet is down, this computer keeps working. Changes catch up when it returns.
        </p>
        {status?.linked && (
          <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Linked to {status.subdomain}. {status.lastError ? status.lastError : status.lastSync ? `Last sync ${new Date(status.lastSync).toLocaleString()}.` : 'Waiting for the first sync.'}
          </p>
        )}
        <form className="mt-6 space-y-3" onSubmit={connect}>
          <label className="block text-sm font-semibold text-ghana-black">
            Cloud address
            <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-normal" value={cloudUrl} onChange={(event) => setCloudUrl(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-ghana-black">
            Hotel code
            <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-normal" value={subdomain} onChange={(event) => setSubdomain(event.target.value)} autoComplete="organization" />
          </label>
          <label className="block text-sm font-semibold text-ghana-black">
            Email
            <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-normal" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
          </label>
          <label className="block text-sm font-semibold text-ghana-black">
            Password
            <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-normal" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-[#0B5F64] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? 'Linking…' : 'Link this computer'}
          </button>
        </form>
        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
      </div>
    </div>
  )
}
