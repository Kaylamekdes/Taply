// Creates a signed, expiring link to the private client onboarding form.
//
//   node scripts/make-link.mjs "Client or company name" [days=14] [https://your-domain]
//
// Needs FORM_LINK_SECRET (the same value as in Vercel). It is read from the
// environment, or from .env.local / .env in the project root if present.
// The domain comes from the third argument or SITE_URL.
import { createHmac, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
for (const name of ['.env.local', '.env']) {
  const file = root + name
  if (!existsSync(file)) continue
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

const [client, daysArg, domainArg] = process.argv.slice(2)
const secret = process.env.FORM_LINK_SECRET
const site = (domainArg || process.env.SITE_URL || '').replace(/\/+$/, '')
const days = daysArg === undefined ? 14 : Number(daysArg)

const fail = (msg) => {
  console.error(msg)
  process.exit(1)
}
if (!client || !client.trim()) fail('Usage: node scripts/make-link.mjs "Client or company name" [days=14] [https://your-domain]')
if (!secret) fail('FORM_LINK_SECRET is not set. Add it to .env.local or run: FORM_LINK_SECRET=... node scripts/make-link.mjs ...')
if (!Number.isFinite(days) || days <= 0 || days > 365) fail('Days must be a number between 1 and 365.')
if (!/^https?:\/\/[^/]+$/.test(site)) fail('Set SITE_URL (for example https://taply.example) or pass the domain as the third argument.')

// Reference ID: TP- plus 6 characters without look-alikes (0/O, 1/I).
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const id = 'TP-' + [...randomBytes(6)].map((b) => alphabet[b % alphabet.length]).join('')
const exp = Math.floor(Date.now() / 1000) + Math.round(days * 86400)

const payload = Buffer.from(JSON.stringify({ id, client: client.trim().slice(0, 120), exp })).toString('base64url')
const signature = createHmac('sha256', secret).update(payload).digest('base64url')
const link = `${site}/onboard?t=${payload}.${signature}`

console.log(link)
console.error(`Reference ${id} for "${client.trim()}", valid until ${new Date(exp * 1000).toISOString().slice(0, 10)}`)
