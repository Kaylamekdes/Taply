import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/*
 * Local development only: serves /api/verify and /api/submit from the same
 * handler files Vercel runs (api/*.ts), so `npm run dev` exercises the real
 * onboarding API. Mail settings come from .env.local; without them, submit
 * runs in DEV MODE (logs the brief instead of emailing it).
 */
function localApi(): Plugin {
  return {
    name: 'taply-local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = /^\/api\/(verify|submit)(?:\?|$)/.exec(req.url ?? '')
        if (!m) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`)
          await mod.default(req, res)
        } catch (e) {
          server.config.logger.error(String(e))
          if (!res.headersSent) {
            res.statusCode = 500
            res.end('{"ok":false,"error":"server"}')
          }
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of ['FORM_LINK_SECRET', 'NOTIFY_EMAIL', 'GMAIL_USER', 'GMAIL_APP_PASSWORD']) {
    if (env[k] && !process.env[k]) process.env[k] = env[k]
  }
  return {
    plugins: [react(), localApi()],
  }
})
