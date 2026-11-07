import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

// Manrope (variable, 400–800) and DM Mono are self-hosted via Fontsource so the
// page renders identically offline and without a third-party font request.
import '@fontsource-variable/manrope'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'

import './styles.css'
import App from './App'

// Only hide reveal elements once we know JavaScript is running, so content is
// never permanently hidden if the script fails.
document.documentElement.classList.add('js')
// Safety net: if the app never mounts its motion layer, drop the guard so
// nothing stays hidden.
window.setTimeout(() => {
  if (!document.documentElement.classList.contains('fx-ready')) document.documentElement.classList.remove('js')
}, 2500)

// Private client onboarding form: link-only, loaded on demand, kept out of search.
const isOnboarding = /^\/onboard\/?$/.test(window.location.pathname)
const OnboardingPage = lazy(() => import('./onboard/OnboardingPage'))
if (isOnboarding) {
  const robots = document.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex,nofollow'
  document.head.appendChild(robots)
  document.title = 'Taply: your card details'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isOnboarding ? (
      <Suspense fallback={null}>
        <OnboardingPage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
