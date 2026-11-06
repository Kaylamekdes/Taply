import type { CSSProperties } from 'react'
import { BrandMark, CTA, ORDER_LINK_NOTE, ORDER_URL } from './shared'

const LINES = [
  { words: ['Make', 'the'] },
  { words: ['connection', 'count.'], accent: true },
]

export function FinalCTA() {
  let n = 0
  return (
    <section className="final" data-loop>
      <div className="final__bg" aria-hidden="true">
        <span className="final__field" data-parallax="0.05" />
        <span className="final__lines" />
      </div>
      <div className="container final__inner stagger">
        <BrandMark variant="symbol" className="final__symbol" />
        <p className="eyebrow eyebrow--plain eyebrow--dark">
          <span>Ready when you are</span>
          <span className="eyebrow__rule eyebrow__rule--lime" aria-hidden="true" />
        </p>
        <h2 className="final__title">
          {LINES.map((line) => (
            <span className={`final__line${line.accent ? ' accent-lime' : ''}`} key={line.words.join(' ')}>
              {line.words.map((w, i) => (
                <span key={w}>
                  {i > 0 && ' '}
                  <span className="w">
                    <span className="w__in" style={{ '--w': n++ } as CSSProperties}>
                      {w}
                    </span>
                  </span>
                </span>
              ))}
            </span>
          ))}
        </h2>
        <p className="lede final__lede">Give people a simple way to remember you.</p>
        <div>
          <CTA href={ORDER_URL} variant="white" external srNote={ORDER_LINK_NOTE}>
            Get your Taply card — KES&nbsp;5,500
          </CTA>
        </div>
      </div>
    </section>
  )
}
