/*
 * Synthesised sound for the opening sequence (Web Audio API, no files).
 *
 * One engine per page (module-level singleton, created lazily): it survives
 * re-renders, StrictMode remounts and the intro unmounting. No React cleanup
 * closes it; once the intro is over it is only suspended. If the browser ever
 * closes the context, a fresh one is built on the next use.
 *
 * Unlocking (iOS Safari is the strictest): audio only starts from a user
 * activation, and on iOS that means touchend, pointerup, click or keydown,
 * not touchstart or a touch pointerdown. Each of those events calls
 * `unlock()` until the context is confirmed 'running'. Inside the event it
 * resumes the context, plays a one-sample silent buffer and a tiny silent
 * <audio> element (both started synchronously, as iOS requires), then awaits
 * the resume. 'suspended', 'interrupted' and 'closed' all count as locked.
 *
 * navigator.audioSession.type = 'playback' (iOS 16.4+) lets the sound play
 * with the ringer switch on silent.
 *
 * Diagnostics: `?audiodebug=1` logs to the console and shows an on-screen
 * panel (AudioDebugPanel). Off by default.
 */

// Only the visitor's explicit mute (the sound button) is remembered, per
// session. Keys from earlier versions are ignored and deleted.
const PREF_KEY = 'taply-intro-sound-v2'
const LEGACY_KEYS = ['taply-sound']

export const AUDIO_DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('audiodebug')
const DEBUG = AUDIO_DEBUG
const debug = (...args: unknown[]) => {
  if (DEBUG) console.debug('[intro-audio]', ...args)
}
let lastError: string | null = null
const warn = (what: string, err: unknown) => {
  lastError = `${what}: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`
  console.warn(`[intro-audio] ${what}`, err)
}

// Seconds between "now" and when a sound starts, so its whole envelope is
// rendered even if the audio thread is a block ahead (larger on iOS).
const LOOKAHEAD = 0.015

function migratePrefs() {
  for (const k of LEGACY_KEYS) {
    try {
      window.sessionStorage.removeItem(k)
      window.localStorage.removeItem(k)
    } catch (e) {
      warn('storage unavailable while removing old sound keys', e)
    }
  }
}

export function readSoundPref(): boolean {
  try {
    return window.sessionStorage.getItem(PREF_KEY) !== 'off'
  } catch (e) {
    warn('storage unavailable, sound defaults to on', e)
    return true
  }
}

function writeSoundPref(on: boolean) {
  try {
    if (on) window.sessionStorage.removeItem(PREF_KEY)
    else window.sessionStorage.setItem(PREF_KEY, 'off')
  } catch (e) {
    warn('could not store the sound preference', e)
  }
}

type AudioCtor = typeof AudioContext
const audioCtor = (): AudioCtor | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext)

// ---------------------------------------------------------------- synthesis
// Shared by the live engine and the offline check (renderClickOffline).
type Chain = { ctx: BaseAudioContext; master: GainNode; clickBus: GainNode; noise: AudioBuffer }

function buildChain(ctx: BaseAudioContext): Chain {
  // Everything meets a gentle limiter, then make-up gain, so the clicks can
  // be loud on a phone speaker without ever clipping or sounding harsh.
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.knee.value = 6
  limiter.ratio.value = 12
  limiter.attack.value = 0.001
  limiter.release.value = 0.06
  const out = ctx.createGain()
  out.gain.value = 1.4
  limiter.connect(out).connect(ctx.destination)
  // Whoosh and shimmer.
  const master = ctx.createGain()
  master.gain.value = 0.3
  master.connect(limiter)
  // Key clicks get their own, louder bus.
  const clickBus = ctx.createGain()
  clickBus.gain.value = 1.4
  clickBus.connect(limiter)
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return { ctx, master, clickBus, noise }
}

const env = (g: GainNode, t: number, peak: number, attack: number, release: number) => {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release)
}

/**
 * Mechanical key at time `t`: filtered noise tick + a short 2-4kHz clack (so
 * it carries on small phone speakers) + low thock, lightly randomised.
 * `pitch` below 1 makes a deeper key (Shift, space bar); 1 is unchanged.
 */
function playClick({ ctx: c, clickBus: out, noise }: Chain, t: number, pitch = 1) {
  const v = 0.6 + Math.random() * 0.35

  const src = c.createBufferSource()
  src.buffer = noise
  src.playbackRate.value = 0.85 + Math.random() * 0.3
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = (2400 + Math.random() * 1600) * pitch
  bp.Q.value = 1.4
  const g = c.createGain()
  env(g, t, 0.5 * v, 0.002, 0.03)
  src.connect(bp).connect(g).connect(out)
  src.start(t, Math.random() * 0.8)
  src.stop(t + 0.05)

  // High-mid clack: the part a phone speaker can actually reproduce.
  const clk = c.createOscillator()
  clk.type = 'square'
  clk.frequency.value = (2600 + Math.random() * 500) * pitch
  const cbp = c.createBiquadFilter()
  cbp.type = 'bandpass'
  cbp.frequency.value = 3000 * pitch
  cbp.Q.value = 2
  const cg = c.createGain()
  env(cg, t, 0.16 * v, 0.001, 0.018)
  clk.connect(cbp).connect(cg).connect(out)
  clk.start(t)
  clk.stop(t + 0.03)

  const osc = c.createOscillator()
  osc.type = 'triangle'
  const f = (140 + Math.random() * 50) * pitch
  osc.frequency.setValueAtTime(f, t)
  osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.07)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const og = c.createGain()
  env(og, t, 0.42 * v, 0.004, 0.075)
  osc.connect(lp).connect(og).connect(out)
  osc.start(t)
  osc.stop(t + 0.1)
}

/** Soft air movement for the card slide. */
function playWhoosh({ ctx: c, master: out, noise }: Chain, t: number) {
  const src = c.createBufferSource()
  src.buffer = noise
  src.loop = true
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.9
  bp.frequency.setValueAtTime(260, t)
  bp.frequency.exponentialRampToValueAtTime(1800, t + 0.35)
  bp.frequency.exponentialRampToValueAtTime(600, t + 0.75)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.28)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
  src.connect(bp).connect(g).connect(out)
  src.start(t)
  src.stop(t + 0.85)
}

/** Subtle high shimmer for the specular sweep. */
function playShimmer({ ctx: c, master: out }: Chain, t: number) {
  ;[1760, 2349, 2637, 3520].forEach((freq, i) => {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.004)
    const g = c.createGain()
    env(g, t + i * 0.07, 0.035, 0.03, 0.5)
    o.connect(g).connect(out)
    o.start(t + i * 0.07)
    o.stop(t + i * 0.07 + 0.6)
  })
}

/** Renders one key click offline (same synthesis and output chain) and returns the samples. */
export async function renderClickOffline(pitch = 1): Promise<Float32Array> {
  const rate = 48000
  const off = new OfflineAudioContext(1, Math.round(rate * 0.25), rate)
  playClick(buildChain(off), 0.01, pitch)
  const buf = await off.startRendering()
  return buf.getChannelData(0)
}


// ---------------------------------------------------------------- engine
type AudioSessionNav = Navigator & { audioSession?: { type: string } }

/** A 10ms silent mono WAV, as a data URI (for the <audio> unlock on iOS). */
function silentWavUri(): string {
  const samples = 80 // 10ms at 8kHz
  const buf = new ArrayBuffer(44 + samples * 2)
  const v = new DataView(buf)
  const text = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)))
  text(0, 'RIFF')
  v.setUint32(4, 36 + samples * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, 8000, true)
  v.setUint32(28, 16000, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  text(36, 'data')
  v.setUint32(40, samples * 2, true)
  let bin = ''
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)))
  return `data:audio/wav;base64,${btoa(bin)}`
}

export function browserName(ua = navigator.userAgent): string {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const pick =
    (/CriOS\/([\d.]+)/.exec(ua) && 'Chrome') ||
    (/FxiOS\/([\d.]+)/.exec(ua) && 'Firefox') ||
    (/EdgiOS\/|Edg\/([\d.]+)/.exec(ua) && 'Edge') ||
    (/Chrome\/([\d.]+)/.exec(ua) && 'Chrome') ||
    (/Firefox\/([\d.]+)/.exec(ua) && 'Firefox') ||
    (/Version\/([\d.]+).*Safari/.exec(ua) && 'Safari') ||
    'Unknown'
  const os = /OS (\d+[_\d]*) like Mac OS X/.exec(ua)
  return `${pick}${ios ? ' (iOS' + (os ? ' ' + os[1].replace(/_/g, '.') : '') + ')' : ''}`
}

function createIntroAudio() {
  migratePrefs()
  let enabled = readSoundPref()
  let ctx: AudioContext | null = null
  let chain: Chain | null = null
  let onChange: (() => void) | null = null
  let gesture: string | null = null
  let scheduled = 0
  let htmlAudio: HTMLAudioElement | null = null

  // iOS 16.4+: play through the ringer switch's silent mode.
  try {
    const nav = navigator as AudioSessionNav
    if (nav.audioSession) nav.audioSession.type = 'playback'
  } catch (e) {
    warn('could not set navigator.audioSession.type', e)
  }

  const notify = () => {
    debug('state ->', ctx?.state)
    onChange?.()
  }

  /** The context and its output chain; rebuilt only if the browser closed it. */
  const build = (): AudioContext | null => {
    if (ctx && ctx.state !== 'closed') return ctx
    const Ctor = audioCtor()
    if (!Ctor) return null
    try {
      ctx = new Ctor()
      chain = buildChain(ctx)
      ctx.onstatechange = notify
      debug('context created, state', ctx.state, 'sampleRate', ctx.sampleRate)
    } catch (e) {
      warn('could not create the AudioContext', e)
      ctx = null
      chain = null
    }
    return ctx
  }

  const isRunning = () => !!ctx && ctx.state === 'running'

  /** Resume without a gesture (visibility, pageshow): may be refused, never throws. */
  const tryResume = () => {
    if (!enabled || !ctx || ctx.state === 'running' || ctx.state === 'closed') return
    ctx.resume().then(notify, (e) => warn('resume() refused', e))
  }

  /**
   * Must be called synchronously from a touchend / pointerup / click / keydown
   * handler. Starts the resume, a silent buffer and a silent <audio> inside the
   * gesture, then awaits the resume. Returns whether audio is now running.
   */
  const unlock = async (eventType = 'gesture', force = false): Promise<boolean> => {
    gesture = eventType
    if (!enabled && !force) return false
    const c = build()
    if (!c) return false
    if (c.state === 'running') return true
    debug('unlock attempt from', eventType, 'state', c.state)
    let resuming: Promise<void> | null = null
    try {
      resuming = c.resume()
    } catch (e) {
      warn('resume() threw', e)
    }
    try {
      const silent = c.createBufferSource()
      silent.buffer = c.createBuffer(1, 1, c.sampleRate)
      silent.connect(c.destination)
      silent.start(0)
    } catch (e) {
      warn('silent buffer failed', e)
    }
    try {
      if (!htmlAudio) {
        htmlAudio = new Audio(silentWavUri())
        htmlAudio.loop = false
        htmlAudio.preload = 'auto'
        htmlAudio.setAttribute('playsinline', '')
      }
      htmlAudio.currentTime = 0
      htmlAudio.play().catch((e) => warn('silent <audio> play() refused', e))
    } catch (e) {
      warn('silent <audio> failed', e)
    }
    try {
      if (resuming) await resuming
    } catch (e) {
      warn('resume() refused', e)
    }
    notify()
    return isRunning()
  }

  // Each sound checks the state at the moment it fires: play if running, skip if not.
  const play = (name: string, fn: (ch: Chain, t: number) => void, force = false) => {
    if ((!enabled && !force) || !ctx || !chain || ctx.state !== 'running') {
      debug(name, 'skipped: sound', enabled ? 'on' : 'off', 'state', ctx?.state ?? 'no context')
      return
    }
    const t = ctx.currentTime + LOOKAHEAD
    try {
      fn(chain, t)
      scheduled++
      debug(name, 'scheduled at', t.toFixed(3), 'state', ctx.state, 'master', chain.master.gain.value, 'clicks', chain.clickBus.gain.value)
    } catch (e) {
      warn(`${name} failed`, e)
    }
  }

  return {
    /** When the intro starts: with a user activation already on the page, start now. */
    start() {
      const active = !!(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
        ?.hasBeenActive
      debug('intro start: sound', enabled ? 'on' : 'off (muted)', 'activation', active, 'state', ctx?.state ?? 'no context')
      if (!enabled) return
      if (active) {
        build()
        tryResume()
      }
    },

    /** Call from a touchend / pointerup / click / keydown handler. */
    unlock,

    /** True only when the context is confirmed 'running'. */
    get running() {
      return isRunning()
    },

    /** False when the browser has no Web Audio at all. */
    get supported() {
      return !!audioCtor()
    },

    /** Called whenever the context's state changes (locked -> running, suspended, ...). */
    onStateChange(cb: (() => void) | null) {
      onChange = cb
    },

    get enabled() {
      return enabled
    },

    /** Only the sound button calls this. */
    setEnabled(on: boolean) {
      enabled = on
      writeSoundPref(on)
      debug('sound', on ? 'on' : 'off')
      if (on) void unlock('sound button')
      else ctx?.suspend().catch((e) => warn('suspend() failed', e))
    },

    /** One key press; `pitch` below 1 for Shift and the space bar. */
    click(pitch = 1) {
      play(pitch < 1 ? 'click (deep)' : 'click', (ch, t) => playClick(ch, t, pitch))
    },

    whoosh() {
      play('whoosh', playWhoosh)
    },

    shimmer() {
      play('shimmer', playShimmer)
    },

    /** Debug panel: unlock from this tap (even if muted) and play one click. */
    async testClick() {
      const ok = await unlock('test button', true)
      play('test click', (ch, t) => playClick(ch, t), true)
      return ok
    },

    /** Tab hidden, or the intro is over: pause output (the context stays alive). */
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch((e) => warn('suspend() failed', e))
    },

    /** Tab visible again / page restored from the back-forward cache: try again. */
    resume() {
      tryResume()
    },

    /** Live values for the debug panel. */
    diagnostics() {
      return {
        state: ctx ? ctx.state : 'no context yet',
        audioSession: (navigator as AudioSessionNav).audioSession?.type ?? 'not supported',
        gesture: gesture ?? 'none yet',
        masterGain: chain ? chain.master.gain.value : null,
        clickGain: chain ? chain.clickBus.gain.value : null,
        muted: !enabled,
        scheduled,
        lastError: lastError ?? 'none',
        browser: browserName(),
      }
    },
  }
}

export type IntroAudio = ReturnType<typeof createIntroAudio>

let engine: IntroAudio | null = null
/** The page's single audio engine, created on first use and never closed. */
export function getIntroAudio(): IntroAudio {
  if (!engine) engine = createIntroAudio()
  return engine
}

// Diagnostics only: lets a test render one click offline with the real code.
if (DEBUG) (window as unknown as Record<string, unknown>).__introAudio = { getIntroAudio, renderClickOffline }
