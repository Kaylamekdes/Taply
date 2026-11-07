import type { IncomingMessage, ServerResponse } from 'node:http'

/*
 * Plain Node request/response helpers, so the handlers run unchanged on
 * Vercel and in the local Vite dev server (see vite.config.ts).
 */

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.end(JSON.stringify(body))
}

export function queryParam(req: IncomingMessage, name: string): string | null {
  const url = new URL(req.url ?? '/', 'http://localhost')
  return url.searchParams.get(name)
}

export function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for']
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim()
  return first || req.socket.remoteAddress || 'unknown'
}

/** Deployed on Vercel (preview or production), as opposed to local development. */
export const isDeployed = () => process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview'
