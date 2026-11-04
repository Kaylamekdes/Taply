import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import '../intro.css'
import { ProductCard } from './ProductCard'
import { INTRO_SHOULD_PLAY, releasePage, setPageInert, useIntroTimeline } from '../hooks/useIntro'
import type { Cue } from '../hooks/useIntro'
import { createIntroAudio } from '../hooks/introAudio'

/*
 * Opening sequence, played once per session before the hero.
 * Self-contained: delete this file, intro.css, hooks/useIntro.ts,
 * hooks/introAudio.ts and the <IntroSequence /> line in App.tsx to remove it.
 *
 * Copy is limited to confirmed brand lines: "Meet. Tap. Continue." and
 * "Make the first hello go further."
 */

// ---------------------------------------------------------------- keyboard
const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.'],
  ['space'],
]

type Side = 'left' | 'right'
type Finger = 'index' | 'middle' | 'ring' | 'pinky' | 'thumb'

const FINGER_FOR: Record<string, [Side, Finger]> = {}
;(
  [
    ['left', 'pinky', 'QAZ'],
    ['left', 'ring', 'WSX'],
    ['left', 'middle', 'EDC'],
    ['left', 'index', 'RFVTGB'],
    ['right', 'index', 'YHNUJM'],
    ['right', 'middle', 'IK,'],
    ['right', 'ring', 'OL.'],
    ['right', 'pinky', 'P'],
  ] as [Side, Finger, string][]
).forEach(([side, finger, keys]) => [...keys].forEach((k) => (FINGER_FOR[k] = [side, finger])))
FINGER_FOR.space = ['right', 'thumb']

// Typing "Meet. Tap. Continue." with a natural, slightly irregular rhythm (ms).
const PRESSES: [string, number][] = [
  ['M', 620], ['E', 770], ['E', 875], ['T', 1040], ['.', 1220],
  ['space', 1420], ['T', 1590], ['A', 1730], ['P', 1890], ['.', 2060],
  ['space', 2250], ['C', 2420], ['O', 2550], ['N', 2665], ['T', 2790],
  ['I', 2910], ['N', 3020], ['U', 3135], ['E', 3255], ['.', 3420],
]
const WORDS = ['Meet.', 'Tap.', 'Continue.']
// Each word lands on its final key press (the full stop).
const WORD_AT = [1220, 2060, 3420]

const PHRASE = [
  { w: 'Make' }, { w: 'the' }, { w: 'first' }, { w: 'hello' },
  { w: 'go', accent: true }, { w: 'further.', accent: true },
]

// Timeline (ms)
const T = {
  hands: 150,
  rise: 3500,
  tumble: 4250,
  soften: 4900,
  zoom: 4950,
  sweep: 5050,
  phrase: 5500,
  leave: 6600,
  done: 7600,
}

// ---------------------------------------------------------------- hands
// SVG units. Right hand; the left hand is mirrored about x = 54.
const VB = { x: -12, w: 132, h: 190 }
const TIPS: Record<Finger, [number, number]> = {
  index: [24, 24],
  middle: [46, 12],
  ring: [68, 20],
  pinky: [88, 40],
  thumb: [-4, 79],
}
const FINGER_RECTS: [Finger, number, number][] = [
  ['index', 24, 18],
  ['middle', 46, 6],
  ['ring', 68, 14],
  ['pinky', 88, 34],
]
const HAND_ANGLE = (-14 * Math.PI) / 180

function Hand({ side }: { side: Side }) {
  return (
    <div className={`intro-hand intro-hand--${side}`} data-hand={side}>
      <div className="intro-hand__dip">
        <svg viewBox={`${VB.x} 0 ${VB.w} ${VB.h}`} overflow="visible" aria-hidden="true">
          <g transform={side === 'left' ? 'translate(108 0) scale(-1 1)' : undefined}>
            <g data-finger="thumb">
              <rect x="-2" y="70" width="16" height="56" rx="8" transform="rotate(-28 6 98)" />
            </g>
            {FINGER_RECTS.map(([name, cx, top]) => (
              <g data-finger={name} key={name}>
                <rect x={cx - 8} y={top} width="16" height={104 - top} rx="8" />
              </g>
            ))}
            <rect className="intro-hand__palm" x="14" y="70" width="90" height="86" rx="28" />
            <rect className="intro-hand__cuff" x="16" y="146" width="86" height="48" rx="6" />
            <rect className="intro-hand__accent" x="16" y="151" width="86" height="5" />
          </g>
        </svg>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- component
export function IntroSequence() {
  const [done, setDone] = useState(!INTRO_SHOULD_PLAY)
  if (done) return null
  return <IntroOverlay onDone={() => setDone(true)} />
}

function IntroOverlay({ onDone }: { onDone: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const flyRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<HTMLParagraphElement>(null)
  const audioRef = useRef<ReturnType<typeof createIntroAudio> | null>(null)
  if (!audioRef.current) audioRef.current = createIntroAudio()
  const [soundOn, setSoundOn] = useState(audioRef.current.enabled)
  const finishedRef = useRef(false)
  const flewRef = useRef(false)

  // ---- finish / skip
  const finish = (skipped: boolean) => {
    if (finishedRef.current) return
    finishedRef.current = true
    stopRef.current()
    audioRef.current?.close()

    const html = document.documentElement
    const root = rootRef.current
    const focusInside = !!root && root.contains(document.activeElement)
    const complete = () => {
      if (flewRef.current && !skipped) html.classList.add('intro-landed')
      releasePage()
      if (focusInside) {
        const main = document.querySelector<HTMLElement>('main')
        if (main) {
          main.setAttribute('tabindex', '-1')
          main.focus({ preventScroll: true })
        }
      }
      onDone()
    }

    if (skipped && root) {
      // Clean jump: stop everything in place, fade the overlay, start the hero.
      root.getAnimations({ subtree: true }).forEach((a) => a.pause())
      html.classList.remove('intro-playing', 'intro-flying')
      root.classList.add('is-skipping')
      window.setTimeout(complete, 320)
    } else {
      complete()
    }
  }

  // ---- the timeline
  const stopRef = useIntroTimeline(
    rootRef,
    () => {
      const root = rootRef.current!
      const stage = stageRef.current!
      const audio = audioRef.current!
      const cues: Cue[] = []
      const add = (at: number, run: () => void) => cues.push({ at, run })
      const phase = (at: number, name: string) => add(at, () => root.classList.add(name))

      const hands: Record<Side, HTMLElement> = {
        left: root.querySelector<HTMLElement>('[data-hand="left"]')!,
        right: root.querySelector<HTMLElement>('[data-hand="right"]')!,
      }
      const keyEl = (k: string) => root.querySelector<HTMLElement>(`[data-key="${k === '.' ? 'dot' : k === ',' ? 'comma' : k}"]`)!

      // Place a hand so the given fingertip sits over a key's centre.
      const placeHand = (side: Side, finger: Finger, key: string, duration: number) => {
        const hand = hands[side]
        const cap = keyEl(key).querySelector<HTMLElement>('.intro-key__cap')!
        const kr = cap.getBoundingClientRect()
        const sr = ((hand.offsetParent as HTMLElement | null) ?? stage).getBoundingClientRect()
        const kx = kr.left + kr.width / 2 - sr.left
        const ky = kr.top + kr.height / 2 - sr.top
        const s = hand.offsetWidth / VB.w
        let [fx, fy] = TIPS[finger]
        if (side === 'left') fx = 108 - fx
        const px = (fx - VB.x) * s
        const py = fy * s
        const rx = px * Math.cos(HAND_ANGLE) - py * Math.sin(HAND_ANGLE)
        const ry = px * Math.sin(HAND_ANGLE) + py * Math.cos(HAND_ANGLE)
        hand.style.transitionDuration = `${duration}ms`
        hand.style.transform = `translate3d(${(kx - rx).toFixed(1)}px, ${(ky - ry).toFixed(1)}px, 0) rotate(${HAND_ANGLE}rad)`
      }

      const press = (key: string) => {
        const [side, finger] = FINGER_FOR[key]
        const hand = hands[side]
        hand.querySelector('.intro-hand__dip')?.animate(
          [{ transform: 'none' }, { transform: 'translateY(3%)' }, { transform: 'none' }],
          { duration: 170, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        )
        hand.querySelector(`[data-finger="${finger}"]`)?.animate(
          [{ transform: 'none' }, { transform: 'translateY(4px)' }, { transform: 'none' }],
          { duration: 170, easing: 'ease-out' },
        )
        const k = keyEl(key)
        k.querySelector('.intro-key__cap')?.animate(
          [
            { transform: 'translateZ(6px)' },
            { transform: 'translateZ(1px)', offset: 0.3 },
            { transform: 'translateZ(7px)', offset: 0.7 },
            { transform: 'translateZ(6px)' },
          ],
          { duration: 240, easing: 'ease-out' },
        )
        k.querySelector('.intro-key__glow')?.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 520,
          easing: 'ease-out',
        })
        audio.click()
      }

      // Stage set-up
      add(0, () => {
        placeHand('left', 'index', 'F', 0)
        placeHand('right', 'index', 'J', 0)
        root.classList.add('is-on')
      })
      add(300, () => {
        if (liveRef.current) liveRef.current.textContent = 'Taply — make the first hello go further.'
      })
      phase(T.hands, 'is-hands')

      // Typing
      const lastPress: Record<Side, number> = { left: 0, right: 0 }
      PRESSES.forEach(([key, at]) => {
        const [side, finger] = FINGER_FOR[key]
        const moveAt = Math.max(at - 130, lastPress[side] + 45)
        lastPress[side] = at
        add(moveAt, () => placeHand(side, finger, key, Math.max(60, at - moveAt - 10)))
        add(at, () => press(key))
      })
      add(3560, () => {
        placeHand('left', 'index', 'F', 260)
        placeHand('right', 'index', 'J', 260)
      })
      WORD_AT.forEach((at, i) =>
        add(at, () => root.querySelector(`[data-word="${i}"]`)?.classList.add('is-in')),
      )

      // Card
      add(T.rise, () => {
        root.classList.add('is-rise')
        audio.whoosh()
      })
      phase(T.tumble, 'is-tumble')
      phase(T.soften, 'is-soft')
      phase(T.zoom, 'is-zoom')
      add(T.sweep, () => {
        root.classList.add('is-sweep')
        audio.shimmer()
      })
      phase(T.phrase, 'is-phrase')

      // Handoff
      add(T.leave, () => {
        const html = document.documentElement
        const fly = flyRef.current
        const front = document.querySelector<HTMLElement>('.stage__card--front')
        const card = fly?.querySelector<HTMLElement>('.pcard')
        html.classList.add('intro-flying') // hero front card at rest (and hidden) for measuring
        let flew = false
        if (fly && front && card) {
          const r0 = card.getBoundingClientRect()
          const rt = front.getBoundingClientRect()
          const ct = { x: rt.left + rt.width / 2, y: rt.top + rt.height / 2 }
          const vw = window.innerWidth
          const vh = window.innerHeight
          const onScreen = ct.x > 0 && ct.x < vw && ct.y > vh * 0.12 && ct.y < vh * 0.88
          if (onScreen && r0.width > 0) {
            const dx = ct.x - (r0.left + r0.width / 2)
            const dy = ct.y - (r0.top + r0.height / 2)
            const k = front.offsetWidth / r0.width
            fly.animate(
              [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k}) rotate(-9deg)` }],
              { duration: 950, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' },
            )
            flew = true
          }
        }
        flewRef.current = flew
        if (!flew) {
          html.classList.remove('intro-flying')
          root.classList.add('is-fade-card')
        }
        // The hero's own entrance starts as the overlay leaves.
        html.classList.remove('intro-playing')
        root.classList.add('is-leave')
      })
      add(T.done, () => finish(false))

      return cues
    },
    (hidden) => {
      if (hidden) audioRef.current?.suspend()
      else audioRef.current?.resume()
    },
  )

  // ---- page state, gestures, Escape
  useEffect(() => {
    const html = document.documentElement
    html.classList.add('intro-mounted', 'intro-lock')
    if (!finishedRef.current) html.classList.add('intro-playing')
    setPageInert(true)

    const unlock = () => audioRef.current?.unlock()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(true)
      else unlock()
    }
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('touchstart', unlock, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('touchstart', unlock)
      window.removeEventListener('keydown', onKey)
      if (!finishedRef.current) releasePage()
    }
    // Mount-only by design.
  }, [])

  const toggleSound = () => {
    const next = !soundOn
    audioRef.current?.setEnabled(next)
    setSoundOn(next)
  }

  return (
    <div className="intro" ref={rootRef}>
      <p className="intro__sr" aria-live="polite" ref={liveRef} />

      <div className="intro__stage" ref={stageRef} aria-hidden="true">
        <span className="intro__grid" />
        <span className="intro__glow" />

        <p className="intro__words">
          {WORDS.map((w, i) => (
            <span className={`iw${i === 2 ? ' iw--accent' : ''}`} data-word={i} key={w}>
              <span className="iw__rise">
                <span className="iw__bob" style={{ '--b': `${i * -0.7}s` } as CSSProperties}>
                  {w}
                </span>
              </span>
            </span>
          ))}
        </p>

        <div className="intro__desk">
          <div className="intro-kb-wrap">
            <span className="intro-kb__shadow" />
            <div className="intro-kb">
              {ROWS.map((row, r) => (
                <div className={`intro-kb__row intro-kb__row--${r}`} key={r}>
                  {row.map((k) => (
                    <span
                      className={`intro-key${k === 'space' ? ' intro-key--space' : ''}`}
                      data-key={k === '.' ? 'dot' : k === ',' ? 'comma' : k}
                      key={k}
                    >
                      <span className="intro-key__cap">
                        <span className="intro-key__glow" />
                        <span className="intro-key__legend">{k === 'space' ? '' : k}</span>
                      </span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <Hand side="left" />
          <Hand side="right" />
        </div>

        <p className="intro__phrase">
          {PHRASE.map((p, i) => (
            <span key={p.w}>
              {i > 0 && ' '}
              <span className={`ip${p.accent ? ' ip--accent' : ''}`}>
                <span className="ip__in" style={{ '--w': i } as CSSProperties}>
                  {p.w}
                </span>
              </span>
            </span>
          ))}
        </p>
      </div>

      <div className="intro__card-layer" aria-hidden="true">
        <div className="intro__card-fly" ref={flyRef}>
          <div className="intro__card-zoom">
            <div className="intro__card-rise">
              <div className="intro__card-tumble">
                <div className="intro__card-front">
                  <ProductCard variant="dark" />
                  <span className="intro__sheen">
                    <i />
                  </span>
                  <span className="intro__nfc-flash" />
                </div>
                <div className="intro__card-back" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="intro__controls">
        <button
          type="button"
          className="intro__btn"
          aria-pressed={soundOn}
          aria-label="Sound"
          title={soundOn ? 'Sound on' : 'Sound off'}
          onClick={toggleSound}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor" />
            {soundOn ? (
              <path d="M13 7.5a3.5 3.5 0 0 1 0 5M15.2 5.2a6.6 6.6 0 0 1 0 9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="m13 7.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
          <span>{soundOn ? 'Sound on' : 'Sound off'}</span>
        </button>
        <button type="button" className="intro__btn intro__btn--skip" onClick={() => finish(true)}>
          Skip
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 3l5 4-5 4M10 3v8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
