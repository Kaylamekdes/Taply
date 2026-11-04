import { StrictMode } from 'react'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
