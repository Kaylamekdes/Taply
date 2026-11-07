import { useEffect, useRef, useState } from 'react'
import type { AnimationEvent, PointerEvent, TransitionEvent, TransitionEventHandler } from 'react'
import { BrandMark, SectionIntro } from './shared'

const REDUCED = '(prefers-reduced-motion: reduce)'
const HOLD_MS = 2500 // front shown face-forward before the automatic flip
const clamp = (v: number) => Math.max(-1, Math.min(1, v))

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCED).matches)
  useEffect(() => {
    const mq = window.matchMedia(REDUCED)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/* The two faces share the ProductCard surface (pcard: ratio, container
   units, gloss and deep shadow). Both are Carbon. The props let the client
   onboarding preview reuse them; the defaults are this section's sample. */
export type FrontProps = { className?: string; logoSrc?: string; tagline?: string; fallback?: 'logo' | 'symbol' }
export type BackProps = { className?: string; name?: string; role?: string; company?: string; photoSrc?: string }

export function CardFront({ className = '', logoSrc, tagline = 'Digital identity, made human.', fallback = 'logo' }: FrontProps) {
  return (
    <div className={`pcard pcard--dark ycard__face ycard__face--front ${className}`}>
      <div className="pcard__face">
        {logoSrc ? (
          <img className="ycard__logo ycard__logo--custom" src={logoSrc} alt="" decoding="async" />
        ) : fallback === 'symbol' ? (
          <BrandMark variant="symbol" className="ycard__logo ycard__logo--symbol" />
        ) : (
          <BrandMark variant="reversed" className="ycard__logo" />
        )}
        {tagline && <span className="ycard__tagline">{tagline}</span>}
        <span className="pcard__gloss" />
      </div>
    </div>
  )
}

export function CardBack({ className = '', name = 'Amara Mensah', role = 'Product Designer', company, photoSrc }: BackProps) {
  return (
    <div className={`pcard pcard--dark ycard__face ycard__face--back ${className}`}>
      <div className="pcard__face">
        <div className="ycard__back">
          <div className="ycard__who">
            {photoSrc && <img className="ycard__photo" src={photoSrc} alt="" decoding="async" />}
            {name && <span className="ycard__name">{name}</span>}
            {role && <span className="ycard__role">{role}</span>}
            {company && <span className="ycard__role">{company}</span>}
          </div>
          <span className="ycard__stroke" />
          <img className="ycard__qr" src="/brand/taply-qr.svg" alt="" width="264" height="264" decoding="async" />
        </div>
        <span className="pcard__gloss" />
      </div>
    </div>
  )
}

/** The turning card itself: both faces, the shared sweep and the physical edge. */
export function CardBody({
  front,
  back,
  onTransitionEnd,
}: {
  front?: FrontProps
  back?: BackProps
  onTransitionEnd?: TransitionEventHandler<HTMLDivElement>
}) {
  return (
    <div className="ycard__card" onTransitionEnd={onTransitionEnd}>
      <CardFront {...front} />
      <CardBack {...back} />
      {/* One shared highlight for the whole card: one sweep per flip. */}
      <span className="ycard__sweep" />
      <span className="ycard__edge ycard__edge--l" />
      <span className="ycard__edge ycard__edge--r" />
      <span className="ycard__edge ycard__edge--t" />
      <span className="ycard__edge ycard__edge--b" />
    </div>
  )
}

/** FRONT / BACK toggle (44px, aria-pressed = showing the back). */
export function FlipButton({ back, disabled, onClick }: { back: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="ycard__flip" aria-pressed={back} disabled={disabled} onClick={onClick}>
      <span className="sr-only">Flip the card: </span>
      <span className={back ? '' : 'is-on'}>Front</span>
      <span aria-hidden="true">/</span>
      <span className={back ? 'is-on' : ''}>Back</span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9M13.5 8a5.5 5.5 0 0 1-9.4 3.9M12.2 1.6v2.8H9.4M3.8 14.4v-2.8h2.8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

type Phase = 'waiting' | 'swoop' | 'rest'
const SAMPLE_LABEL = 'Sample Taply card: front with the Taply logo, back with a name, title and QR code'
type StageProps = { front?: FrontProps; back?: BackProps; label?: string }

/*
 * Plays once when the stage is 35% in view: the card swoops up with a small
 * overshoot and one tumble (like the opening animation's card), holds the
 * front for 2.5s, then flips to the back. Afterwards the Flip button or a
 * tap on the card turns it. Reduced motion shows both faces, still.
 */
export function CardStage({ front, back: backFace, label = SAMPLE_LABEL }: StageProps = {}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const holdTimer = useRef(0)
  const tiltFrame = useRef(0)
  const tiltTarget = useRef({ nx: 0, ny: 0 })
  const [phase, setPhase] = useState<Phase>('waiting')
  const [back, setBack] = useState(false)
  const [flips, setFlips] = useState(0)
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    if (!('IntersectionObserver' in window)) {
      setPhase('rest')
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        setMoving(true)
        setPhase('swoop')
      },
      { threshold: 0.35 },
    )
    io.observe(stage)
    return () => {
      io.disconnect()
      window.clearTimeout(holdTimer.current)
      cancelAnimationFrame(tiltFrame.current)
    }
  }, [])

  const flip = (toBack: boolean) => {
    window.clearTimeout(holdTimer.current)
    setBack(toBack)
    setFlips((n) => n + 1)
    setMoving(true)
  }

  // The swoop has settled: hold the front, then flip once.
  const onSwoopEnd = (e: AnimationEvent) => {
    if (e.target !== e.currentTarget) return
    setPhase('rest')
    setMoving(false)
    holdTimer.current = window.setTimeout(() => flip(true), HOLD_MS)
  }

  const onFlipEnd = (e: TransitionEvent) => {
    if (e.target === e.currentTarget && e.propertyName === 'transform') setMoving(false)
  }

  // Subtle pointer tilt (max 4deg), mouse only, like the hero.
  const applyTilt = () => {
    tiltFrame.current = 0
    const { nx, ny } = tiltTarget.current
    if (tiltRef.current) tiltRef.current.style.transform = `rotateX(${(-ny * 4).toFixed(2)}deg) rotateY(${(nx * 4).toFixed(2)}deg)`
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    tiltTarget.current = {
      nx: clamp(((e.clientX - r.left) / r.width - 0.5) * 2),
      ny: clamp(((e.clientY - r.top) / r.height - 0.5) * 2),
    }
    if (!tiltFrame.current) tiltFrame.current = requestAnimationFrame(applyTilt)
  }
  const onLeave = () => {
    tiltTarget.current = { nx: 0, ny: 0 }
    if (!tiltFrame.current) tiltFrame.current = requestAnimationFrame(applyTilt)
  }

  const ready = phase === 'rest'
  const classes = [
    'ycard',
    `is-${phase}`,
    back && 'is-back',
    moving && 'is-moving',
    flips > 0 && `is-flip-${flips % 2}`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <div
        className="ycard__stage"
        ref={stageRef}
        role="img"
        aria-label={label}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        <span className="ycard__field" aria-hidden="true" data-parallax="0.06" />
        <span className="ycard__shadow" />
        <div className="ycard__pos" onAnimationEnd={onSwoopEnd} onClick={() => ready && flip(!back)}>
          <div className="ycard__view">
            <div className="ycard__tilt" ref={tiltRef}>
              <div className="ycard__tumble">
                <CardBody front={front} back={backFace} onTransitionEnd={onFlipEnd} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <FlipButton back={back} disabled={!ready} onClick={() => flip(!back)} />
    </div>
  )
}

export function StaticCards({ front, back, label = SAMPLE_LABEL }: StageProps = {}) {
  return (
    <div className="ycard ycard--still" role="img" aria-label={label}>
      <span className="ycard__field" aria-hidden="true" />
      <div className="ycard__pair">
        <CardFront {...front} />
        <CardBack {...back} />
      </div>
    </div>
  )
}

export function YourCardSection() {
  const reduced = usePrefersReducedMotion()
  return (
    <section className="section yourcard" id="card">
      <span className="yourcard__lime" aria-hidden="true" data-parallax="0.08" />
      <div className="container yourcard__grid">
        <div className="yourcard__copy stagger">
          <SectionIntro num="05" label="Your card" />
          <h2 className="h2">
            Your card, <span className="accent">your way.</span>
          </h2>
          <p className="lede">Your logo, your name and your QR code on a plastic NFC card.</p>
        </div>
        <div className="yourcard__visual">{reduced ? <StaticCards /> : <CardStage />}</div>
      </div>
    </section>
  )
}
