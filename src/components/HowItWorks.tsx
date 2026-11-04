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

export function HowItWorks() {
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

        <ol className="steps stagger">
          {STEPS.map((s) => (
            <li className="step" key={s.num}>
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
