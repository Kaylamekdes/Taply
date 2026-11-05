/*
 * Synthesised sound for the opening sequence (Web Audio API, no files).
 * The AudioContext is only created on the first user gesture or when sound is
 * switched on, so autoplay rules are never hit. Every call is safe: if audio is
 * unavailable or locked, it silently does nothing.
 */

const PREF_KEY = 'taply-sound'

export function readSoundPref(): boolean {
  try {
    return window.sessionStorage.getItem(PREF_KEY) !== 'off'
  } catch {
    return true
  }
}

function writeSoundPref(on: boolean) {
  try {
    window.sessionStorage.setItem(PREF_KEY, on ? 'on' : 'off')
  } catch {
    /* storage unavailable: preference lasts for this page only */
  }
}

type AudioCtor = typeof AudioContext

export function createIntroAudio() {
  let enabled = readSoundPref()
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noise: AudioBuffer | null = null
  let closed = false

  const ensure = () => {
    if (closed || !enabled) return
    try {
      if (!ctx) {
        const Ctor: AudioCtor | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
        if (!Ctor) return
        ctx = new Ctor()
        master = ctx.createGain()
        master.gain.value = 0.42
        master.connect(ctx.destination)
        noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
        const data = noise.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    } catch {
      ctx = null
    }
  }

  const live = (): AudioContext | null => (enabled && !closed && ctx && ctx.state === 'running' ? ctx : null)

  const safely = (fn: (c: AudioContext, out: GainNode, buf: AudioBuffer) => void) => {
    const c = live()
    if (!c || !master || !noise) return
    try {
      fn(c, master, noise)
    } catch {
      /* never let sound break the animation */
    }
  }

  const env = (g: GainNode, t: number, peak: number, attack: number, release: number) => {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release)
  }

  return {
    /** Call from any user gesture. */
    unlock: ensure,

    get enabled() {
      return enabled
    },

    setEnabled(on: boolean) {
      enabled = on
      writeSoundPref(on)
      if (on) ensure()
      else ctx?.suspend().catch(() => {})
    },

    /**
     * Mechanical key: filtered noise tick + low thock, lightly randomised.
     * `pitch` below 1 makes a deeper key (Shift, space bar); 1 is unchanged.
     */
    click(pitch = 1) {
      safely((c, out, buf) => {
        const t = c.currentTime
        const v = 0.6 + Math.random() * 0.35

        const src = c.createBufferSource()
        src.buffer = buf
        src.playbackRate.value = 0.85 + Math.random() * 0.3
        const bp = c.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = (2400 + Math.random() * 1600) * pitch
        bp.Q.value = 1.4
        const g = c.createGain()
        env(g, t, 0.32 * v, 0.002, 0.032)
        src.connect(bp).connect(g).connect(out)
        src.start(t, Math.random() * 0.8)
        src.stop(t + 0.05)

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
      })
    },

    /** Soft air movement for the card slide. */
    whoosh() {
      safely((c, out, buf) => {
        const t = c.currentTime
        const src = c.createBufferSource()
        src.buffer = buf
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
      })
    },

    /** Subtle high shimmer for the specular sweep. */
    shimmer() {
      safely((c, out) => {
        const t = c.currentTime
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
      })
    },

    suspend() {
      ctx?.suspend().catch(() => {})
    },

    resume() {
      if (enabled && ctx?.state === 'suspended') ctx.resume().catch(() => {})
    },

    close() {
      closed = true
      ctx?.close().catch(() => {})
      ctx = null
    },
  }
}

export type IntroAudio = ReturnType<typeof createIntroAudio>
