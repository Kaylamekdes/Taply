import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { SectionIntro } from './shared'
import { ProductCard } from './ProductCard'
import { ProfilePhone } from './ProfilePhone'

function MeetVisual() {
  return (
    <div className="vis vis--meet" aria-hidden="true">
      <span className="vis__leaf vis__leaf--violet" />
      <span className="vis__leaf vis__leaf--lime" />
    </div>
  )
}

function TapVisual() {
  return (
    <div className="vis vis--tap" aria-hidden="true">
      <div className="vis__nudge">
        <span className="vis__ping" />
        <div className="vis__card">
          <ProductCard variant="dark" />
        </div>
      </div>
    </div>
  )
}

function ContinueVisual() {
  return (
    <div className="vis vis--continue" aria-hidden="true">
      <div className="vis__phone">
        <ProfilePhone rows={3} decorative />
      </div>
    </div>
  )
}

const STEPS = [
  {
    num: '01',
    title: 'Meet',
    text: 'Introduce yourself.',
    visual: <MeetVisual />,
  },
  {
    num: '02',
    title: 'Tap or scan',
    text: 'Tap a compatible phone, or scan the QR code.',
    visual: <TapVisual />,
  },
  {
    num: '03',
    title: 'Continue',
    text: 'Your profile opens, ready to save.',
    visual: <ContinueVisual />,
  },
]

/*
 * Stacked layout (980px and below): the step crossing a thin band at the
 * middle of the viewport is selected (`is-active`, the same look as hover or
 * tap). The last one stays selected in the gaps; leaving the section clears
 * it. Hovering, tapping or focusing a step selects that one while it lasts.
 * Above 980px nothing is set here and hover works as before.
 */
const STACKED = '(max-width: 980px)'

function useScrollActiveStep(listRef: RefObject<HTMLOListElement | null>) {
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list || typeof IntersectionObserver === 'undefined') return
    const mq = window.matchMedia(STACKED)
    const steps = [...list.querySelectorAll<HTMLElement>(':scope > .step')]
    let scrolled: number | null = null
    let held: number | null = null // hover, press or focus: takes priority
    const apply = () => setActive(held ?? scrolled)
    let teardown = () => {}

    const setup = () => {
      teardown()
      if (!mq.matches) {
        scrolled = held = null
        apply()
        return
      }
      // Steps touching the band. The one that entered last wins; if the
      // selected one leaves while another is still in it, that one takes over.
      const inBand = new Set<number>()
      const band = new IntersectionObserver(
        (entries) => {
          let entered: number | null = null
          entries.forEach((e) => {
            const i = steps.indexOf(e.target as HTMLElement)
            if (e.isIntersecting) {
              inBand.add(i)
              entered = i
            } else inBand.delete(i)
          })
          if (entered !== null) scrolled = entered
          else if (scrolled !== null && !inBand.has(scrolled) && inBand.size) scrolled = [...inBand].pop()!
          else return
          apply()
        },
        { rootMargin: '-45% 0px -45% 0px' },
      )
      const section = new IntersectionObserver((entries) => {
        if (!entries[entries.length - 1].isIntersecting) {
          scrolled = null
          apply()
        }
      })
      steps.forEach((s) => band.observe(s))
      section.observe(list)

      const indexOf = (e: Event) => steps.findIndex((s) => s.contains(e.target as Node))
      const onEnter = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return
        held = indexOf(e)
        apply()
      }
      const onLeave = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return
        held = null
        apply()
      }
      // A tap selects that step; scrolling on moves the selection again.
      const onDown = (e: PointerEvent) => {
        const i = indexOf(e)
        if (i < 0) return
        if (e.pointerType !== 'mouse') scrolled = i
        apply()
      }
      const onFocusIn = (e: FocusEvent) => {
        held = indexOf(e)
        if (held < 0) held = null
        apply()
      }
      const onFocusOut = () => {
        held = null
        apply()
      }
      steps.forEach((s) => {
        s.addEventListener('pointerenter', onEnter)
        s.addEventListener('pointerleave', onLeave)
      })
      list.addEventListener('pointerdown', onDown)
      list.addEventListener('focusin', onFocusIn)
      list.addEventListener('focusout', onFocusOut)
      teardown = () => {
        band.disconnect()
        section.disconnect()
        steps.forEach((s) => {
          s.removeEventListener('pointerenter', onEnter)
          s.removeEventListener('pointerleave', onLeave)
        })
        list.removeEventListener('pointerdown', onDown)
        list.removeEventListener('focusin', onFocusIn)
        list.removeEventListener('focusout', onFocusOut)
      }
    }

    setup()
    mq.addEventListener('change', setup)
    return () => {
      mq.removeEventListener('change', setup)
      teardown()
    }
  }, [listRef])

  return active
}

export function HowItWorks() {
  const listRef = useRef<HTMLOListElement>(null)
  const active = useScrollActiveStep(listRef)
  return (
    <section className="section how" id="how" data-loop>
      <div className="container">
        <div className="how__head stagger">
          <div>
            <SectionIntro num="02" label="How it works" />
            <h2 className="h2">
              Meet. Tap. <span className="accent">Continue.</span>
            </h2>
          </div>
          <p className="lede how__sub">From first hello to saved contact in three simple moments.</p>
        </div>

        <ol className="steps stagger" ref={listRef}>
          {STEPS.map((s, i) => (
            <li className={`step${active === i ? ' is-active' : ''}`} key={s.num}>
              <div className="step__in">
                <p className="mono-label step__num">{s.num}</p>
                {s.visual}
                <h3 className="step__title">{s.title}</h3>
                <p className="step__text">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
