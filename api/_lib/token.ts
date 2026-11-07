/*
 * Signed onboarding links. A token is `<payload>.<signature>`:
 *   payload   = base64url(JSON {id, client, exp})   exp in Unix seconds
 *   signature = base64url(HMAC-SHA256(payload, FORM_LINK_SECRET))
 * scripts/make-link.mjs creates them; /api/verify and /api/submit check them.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export type LinkPayload = { id: string; client: string; exp: number }

export type TokenCheck = { ok: true; payload: LinkPayload } | { ok: false; reason: 'missing' | 'invalid' | 'expired' | 'not-configured' }

const b64url = (buf: Buffer) => buf.toString('base64url')

export function sign(payloadB64: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(payloadB64).digest())
}

export function verifyToken(token: string | null | undefined, secret = process.env.FORM_LINK_SECRET): TokenCheck {
  if (!secret) return { ok: false, reason: 'not-configured' }
  if (!token || typeof token !== 'string' || token.length > 1000) return { ok: false, reason: 'missing' }
  const parts = token.split('.')
  if (parts.length !== 2) return { ok: false, reason: 'invalid' }
  const [body, sig] = parts
  const expected = Buffer.from(sign(body, secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'invalid' }
  let payload: LinkPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (
    !payload ||
    typeof payload.id !== 'string' ||
    typeof payload.client !== 'string' ||
    typeof payload.exp !== 'number' ||
    !/^[A-Z0-9-]{4,24}$/.test(payload.id)
  )
    return { ok: false, reason: 'invalid' }
  if (payload.exp * 1000 < Date.now()) return { ok: false, reason: 'expired' }
  return { ok: true, payload: { id: payload.id, client: payload.client.slice(0, 120), exp: payload.exp } }
}
