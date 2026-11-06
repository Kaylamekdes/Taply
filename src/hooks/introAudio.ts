/*
 * Synthesised sound for the opening sequence (Web Audio API, no files).
 *
 * One engine per page (module-level singleton): it survives re-renders,
 * StrictMode remounts and the intro unmounting, and its AudioContext is never
 * closed (only suspended once the intro is over).
 *
 * Browsers keep audio locked until a user gesture. The context is created
 * inside the first tap, click or key press (as iOS Safari expects), resumed
 * there, and a one-sample silent buffer is played to unlock output. Every
 * gesture retries until the context is 'running'; anything else ('suspended',
 * iOS's 'interrupted') counts as locked. If the page already has a user
 * activation, the context is created straight away instead.
 *
 * Diagnostics: add `?audiodebug` to the URL to log the context state, gains,
 * the mute flag and every scheduled sound (console.debug). Off by default.
 */

// Only the visitor's explicit mute is remembered (per session). Keys from
// earlier versions are ignored and removed, so an old value can't mute sound.
const PREF_KEY = 'taply-intro-sound-v2'
const LEGACY_KEYS = ['taply-sound']

const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('audiodebug')
const debug = (...args: unknown[]) => {
  if (DEBUG) console.debug('[intro-audio]', ...args)
}
const warn = (what: string, err: unknown) => console.warn(`[intro-audio] ${what}`, err)

// Seconds between "now" and when a sound starts, so its whole envelope is
// rendered even if the audio thread is a block ahead (larger on iOS).
const LOOKAHEAD = 0.015

function migratePrefs() {
  for (const k of LEGACY_KEYS) {
    try {
      window.sessionStorage.removeItem(k)
      window.localStorage.removeItem(k)
    } catch {
      /* storage unavailable: nothing to migrate */
    }
  }
}

export function readSoundPref(): boolean {
  try {
    return window.sessionStorage.getItem(PREF_KEY) !== 'off'
  } catch {
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
function createIntroAudio() {
  migratePrefs()
  let enabled = readSoundPref()
  let ctx: AudioContext | null = null
  let chain: Chain | null = null
  let onChange: (() => void) | null = null
  const notify = () => {
    debug('state ->', ctx?.state)
    onChange?.()
  }

  /** Creates the context and its output chain once; never closed. */
  const build = (): AudioContext | null => {
    if (ctx) return ctx
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

  // Anything but 'running' ('suspended', iOS Safari's 'interrupted') counts as locked.
  const resume = () => {
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return
    ctx.resume().then(notify, (e) => debug('resume refused', e))
  }

  /** From inside a user gesture: create (first time), resume, and play a silent sample (iOS). */
  const unlock = () => {
    if (!enabled) return
    const c = build()
    if (!c || c.state === 'running') return
    debug('unlock attempt, state', c.state)
    resume()
    try {
      const silent = c.createBufferSource()
      silent.buffer = c.createBuffer(1, 1, c.sampleRate)
      silent.connect(c.destination)
      silent.start(0)
    } catch (e) {
      warn('silent unlock sample failed', e)
    }
  }

  const play = (name: string, fn: (ch: Chain, t: number) => void) => {
    if (!enabled || !ctx || !chain || ctx.state !== 'running') {
      debug(name, 'skipped: enabled', enabled, 'state', ctx?.state ?? 'no context')
      return
    }
    const t = ctx.currentTime + LOOKAHEAD
    try {
      fn(chain, t)
      debug(name, 'scheduled at', t.toFixed(3), 'state', ctx.state, 'master', chain.master.gain.value, 'clicks', chain.clickBus.gain.value)
    } catch (e) {
      warn(`${name} failed`, e)
    }
  }

  return {
    /**
     * When the intro starts. With a user activation already on the page the
     * context is created and resumed now; otherwise the first gesture does it.
     */
    start() {
      const active = !!(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
        ?.hasBeenActive
      debug('intro start: sound', enabled ? 'on' : 'off (muted)', 'activation', active, 'state', ctx?.state ?? 'no context')
      if (!enabled) return
      if (active) {
        build()
        resume()
      }
    },

    unlock,

    /** True once audio is actually playing (not locked or suspended). */
    get running() {
      return !!ctx && ctx.state === 'running'
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

    setEnabled(on: boolean) {
      enabled = on
      writeSoundPref(on)
      debug('sound', on ? 'on' : 'off')
      if (on) unlock()
      else ctx?.suspend().catch((e) => warn('suspend failed', e))
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

    /** Tab hidden, or the intro is over: pause output (the context stays alive). */
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch((e) => warn('suspend failed', e))
    },

    /** Tab visible again / page restored from the back-forward cache: try again. */
    resume() {
      if (enabled) resume()
    },
  }
}

export type IntroAudio = ReturnType<typeof createIntroAudio>

let engine: IntroAudio | null = null
/** The page's single audio engine, created on first use. */
export function getIntroAudio(): IntroAudio {
  if (!engine) engine = createIntroAudio()
  return engine
}

// Diagnostics only: lets a test render one click offline with the real code.
if (DEBUG) (window as unknown as Record<string, unknown>).__introAudio = { getIntroAudio, renderClickOffline }
