import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/*
 * Timing and page-state helpers for the opening sequence (IntroSequence).
 *
 * The play/no-play decision runs once, when this module is first imported,
 * which is before React's first render, so the hero's entrance can be held
 * back without a flash. Nothing here runs unless JS is working, so without JS
 * the site is simply the hero.
 */

const PLAYED_KEY = 'taply-intro-played'
const PAGE_SELECTOR = '.skip-link, .nav-wrap, main, footer'

function decide(): boolean {
  if (typeof window === 'undefined') return false
  try {
    // Note: runs before main.tsx adds `.js` (imports evaluate first); JS is
    // running by definition here.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    const param = new URLSearchParams(window.location.search).get('intro')
    if (param === '0') return false
    if (param !== '1') {
      // Deep links go straight to their section; repeat visits straight to the hero.
      if (window.location.hash) return false
      if (window.sessionStorage.getItem(PLAYED_KEY)) return false
    }
    window.sessionStorage.setItem(PLAYED_KEY, '1')
    return true
  } catch {
    // Storage blocked: we can't promise "once per session", so don't play.
    return false
  }
}

export const INTRO_SHOULD_PLAY = decide()

export function setPageInert(on: boolean) {
  document.querySelectorAll<HTMLElement>(PAGE_SELECTOR).forEach((el) => {
    if (on) el.setAttribute('inert', '')
    else el.removeAttribute('inert')
  })
}

/** Releases everything the intro holds: scroll lock, inert page, paused hero. */
export function releasePage() {
  document.documentElement.classList.remove('intro-playing', 'intro-lock', 'intro-flying', 'intro-gutter')
  setPageInert(false)
}

/** Width of a classic (space-taking) scrollbar; 0 for overlay scrollbars. */
function scrollbarWidth(): number {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;top:-999px;width:100px;height:100px;overflow:scroll'
  document.body.appendChild(probe)
  const w = probe.offsetWidth - probe.clientWidth
  probe.remove()
  return w
}

if (INTRO_SHOULD_PLAY) {
  window.scrollTo(0, 0)
  // Reserve the scrollbar's space during the lock only where scrollbars take
  // space, so releasing the lock never shifts the layout.
  if (scrollbarWidth() > 0) document.documentElement.classList.add('intro-gutter')
  document.documentElement.classList.add('intro-playing', 'intro-lock')
  // Failsafe: if the overlay never mounts (render error), give the page back.
  window.setTimeout(() => {
    if (!document.documentElement.classList.contains('intro-mounted')) releasePage()
  }, 4000)
}

/*
 * The single source of truth for the sequence's stage timings (ms from start).
 * Each stage starts from the end of the one before, so the keyboard and hands
 * are fully gone before the card enters, and everything after the card's rise
 * keeps its original spacing. IntroSequence schedules its cues from this, and
 * passes the dissolve duration to intro.css as `--intro-dissolve`.
 */
const TYPED = 3420 // last key press ("Continue." lands)
const DISSOLVE_AT = TYPED + 180 // after the final key's press-and-spring settles
const DISSOLVE_MS = 600
const CARD_GAP = 120 // breath between the keyboard leaving and the card arriving
const RISE = DISSOLVE_AT + DISSOLVE_MS + CARD_GAP

export const INTRO_T = {
  hands: 150,
  typed: TYPED,
  dissolve: DISSOLVE_AT,
  dissolveMs: DISSOLVE_MS,
  gone: DISSOLVE_AT + DISSOLVE_MS,
  // Card and everything after keep their original offsets from the rise.
  rise: RISE,
  tumble: RISE + 750,
  soften: RISE + 1400,
  zoom: RISE + 1450,
  sweep: RISE + 1550,
  phrase: RISE + 2000,
  leave: RISE + 3100,
  done: RISE + 4100,
} as const

export type Cue = { at: number; run: () => void }

/**
 * Runs cues against a clock that only advances while the tab is visible.
 * While hidden it also pauses every CSS/WAAPI animation inside `rootRef`
 * (and resumes only those it paused), and calls `onHidden` for audio.
 */
export function useIntroTimeline(
  rootRef: RefObject<HTMLElement | null>,
  buildCues: () => Cue[],
  onHidden?: (hidden: boolean) => void,
) {
  const stopRef = useRef<() => void>(() => {})

  useEffect(() => {
    const cues = buildCues().sort((a, b) => a.at - b.at)
    let i = 0
    let elapsed = 0
    let last = 0
    let raf = 0
    let stopped = false
    let paused: Animation[] = []

    const tick = (now: number) => {
      elapsed += now - last
      last = now
      while (i < cues.length && cues[i].at <= elapsed) cues[i++].run()
      if (!stopped && i < cues.length) raf = requestAnimationFrame(tick)
    }
    const start = (now: number) => {
      last = now
      tick(now)
    }
    raf = requestAnimationFrame(start)

    const onVisibility = () => {
      if (stopped) return
      if (document.hidden) {
        cancelAnimationFrame(raf)
        paused = (rootRef.current?.getAnimations({ subtree: true }) ?? []).filter((a) => a.playState === 'running')
        paused.forEach((a) => a.pause())
      } else {
        paused.forEach((a) => a.play())
        paused = []
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(start)
      }
      onHidden?.(document.hidden)
    }
    document.addEventListener('visibilitychange', onVisibility)

    const stop = () => {
      stopped = true
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    stopRef.current = stop
    return stop
    // The cue list is built once per mount by design.
  }, [])

  return stopRef
}
