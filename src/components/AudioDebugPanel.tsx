import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { getIntroAudio } from '../hooks/introAudio'

/*
 * On-screen audio diagnostics for testing on a phone without a console.
 * Only loaded and shown with `?audiodebug=1` (see App.tsx). Sits at the bottom
 * of the screen, above the intro.
 */

const panel: CSSProperties = {
  position: 'fixed',
  left: 8,
  right: 8,
  bottom: 'max(8px, env(safe-area-inset-bottom))',
  zIndex: 2147483647,
  padding: '12px 14px',
  borderRadius: 4,
  background: '#13131f',
  color: '#f4f2ea',
  font: '500 14px/1.45 "DM Mono", ui-monospace, monospace',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
  pointerEvents: 'auto',
}
const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12 }
const val: CSSProperties = { color: '#c8ff4a', textAlign: 'right', overflowWrap: 'anywhere' }
const button: CSSProperties = {
  width: '100%',
  minHeight: 48,
  marginTop: 10,
  border: 0,
  borderRadius: 2,
  background: '#4c1bf1',
  color: '#fff',
  font: '600 16px/1 "Manrope Variable", Manrope, system-ui, sans-serif',
}

export default function AudioDebugPanel() {
  const audio = getIntroAudio()
  const [d, setD] = useState(() => audio.diagnostics())
  const [test, setTest] = useState('')

  useEffect(() => {
    const id = window.setInterval(() => setD(audio.diagnostics()), 250)
    return () => window.clearInterval(id)
  }, [audio])

  const rows: [string, string][] = [
    ['ctx.state', audio.supported ? d.state : 'no Web Audio in this browser'],
    ['audioSession', d.audioSession],
    ['gesture seen', d.gesture],
    ['master / click gain', d.masterGain === null ? '-' : `${d.masterGain.toFixed(2)} / ${d.clickGain!.toFixed(2)}`],
    ['muted', d.muted ? 'yes' : 'no'],
    ['sounds scheduled', String(d.scheduled)],
    ['last error', d.lastError],
    ['browser', d.browser],
  ]

  return (
    <div style={panel} data-audio-debug>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>AUDIO DEBUG</div>
      {rows.map(([k, v]) => (
        <div style={row} key={k}>
          <span>{k}</span>
          <span style={val}>{v}</span>
        </div>
      ))}
      <button
        type="button"
        style={button}
        onClick={() => {
          setTest('…')
          audio.testClick().then(
            (ok) => setTest(ok ? 'played' : 'audio still locked'),
            (e) => setTest(String(e)),
          )
        }}
      >
        Play test click{test ? ` (${test})` : ''}
      </button>
    </div>
  )
}
