import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })

const url = 'https://life-os-gamma-orcin.vercel.app/api/cron/tick'
const headers = { Authorization: `Bearer ${process.env.CRON_SECRET}` }

for (let attempt = 1; attempt <= 12; attempt += 1) {
  const res = await fetch(url, { method: 'POST', headers })
  const body = await res.json()
  console.log(`tick ${attempt}:`, JSON.stringify(body))
  if (body.scheduled > 0 || body.delivered > 0) break
  await new Promise((r) => setTimeout(r, 20000))
}
