import type { CSSProperties } from 'react'
import { BrandMark, SectionIntro } from './shared'

const OLD_WAY = [
  'Lost after the meeting',
  'Outdated when details change',
  'Typed in by hand',
  'Reprinted with every change',
]

export function ProblemSection() {
  return (
    <section className="section problem" id="why" data-loop>
      <div className="container">
        <div className="stagger">
          <SectionIntro num="01" label="Why Taply" />
          <h2 className="h2 problem__title">
            A good introduction shouldn’t end with a <span className="accent">forgotten business card.</span>
          </h2>
        </div>

        <div className="compare stagger">
          <div className="compare__old">
            <p className="mono-label">The old way</p>
            <ol>
              {OLD_WAY.map((text, i) => (
                <li key={text} style={{ '--i': i } as CSSProperties}>
                  <span className="mono-label compare__num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="compare__text">
                    <span className="compare__line">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="compare__new">
            <BrandMark variant="symbol" className="compare__symbol" />
            <div className="compare__new-copy">
              <p className="mono-label">The Taply way</p>
              <h3 className="compare__big">
                One card.
                <br />
                Always current.
              </h3>
              <p>Useful in the moment, and long after the meeting.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
