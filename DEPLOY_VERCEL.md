# Deploy to Vercel

## Prerequisites

- GitHub repo connected to Vercel
- PostgreSQL database (Vercel Postgres, Neon, or Supabase)
- Node.js 18+

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://...`) |
| `NEXTAUTH_URL` | Yes | Production URL, e.g. `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | Yes | Random 32+ char secret (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | Recommended | Same as `NEXTAUTH_URL` |

Optional (email / OAuth if enabled):

- `EMAIL_SERVER`, `EMAIL_FROM`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Build

The repo includes:

- `vercel.json` — Next.js framework, night-audit cron
- `npm run vercel-build` — generates Prisma client, runs `db push` on production schema, then `next build`

**Recommended Vercel project settings:**

- **Build Command:** `npm run vercel-build`
- **Install Command:** `npm ci`
- **Output Directory:** `.next` (default for Next.js)

If you prefer migrations instead of `db push`, replace the build script with `prisma migrate deploy` and manage migrations in CI.

## Deploy steps

1. Push your branch to GitHub.
2. Import the repo in [vercel.com/new](https://vercel.com/new).
3. Add environment variables above.
4. Deploy.

Or with CLI:

```bash
npm i -g vercel
vercel login
vercel --prod
```

## Compliance data on Vercel

- **Tax rules / filing schedules** default from `src/app/lib/compliance/config/*.json` (read-only on serverless).
- Runtime edits to `prisma/compliance.*.json` **do not persist** on Vercel’s ephemeral filesystem. For production, plan to move compliance storage to PostgreSQL or object storage.
- **Operational tax** for folios, AP, inventory, and F&B uses the unified `tax/engine` path synced from compliance on load.

## Post-deploy checks

1. Open **Compliance → Tax Management** — confirm Ghana rules load.
2. Open **Accounting** — tax configs should auto-sync from compliance.
3. Create an F&B order — tax stack should match compliance rates.
4. **Reports & Filing** — suggested amounts populate from ledger + payroll when data exists.

## Cron

`vercel.json` registers `/api/cron/night-audit` at 01:00 UTC daily. Ensure the route validates `CRON_SECRET` if configured.
