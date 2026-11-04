import { useState } from 'react'
import { SectionIntro } from './shared'

const FAQS = [
  {
    q: 'Does Taply work with iPhones?',
    a: 'Compatible iPhones open the profile with an NFC tap, or by scanning the QR code.',
  },
  {
    q: 'Does it work with Android?',
    a: 'Compatible Android phones open the profile with an NFC tap, or by scanning the QR code.',
  },
  {
    q: 'What if someone’s phone doesn’t support NFC?',
    a: 'They can scan the QR code printed on the card.',
  },
  {
    q: 'Does the recipient need to download an app?',
    a: 'No, the profile opens in their browser.',
  },
  {
    q: 'Does the physical card need charging?',
    a: 'No, the NFC card is passive, with no battery and no charging.',
  },
  {
    q: 'Can I update my details after receiving the card?',
    a: 'Yes, your profile can be updated without reprinting the card.',
  },
  {
    q: 'Can I include my social media accounts?',
    a: 'Yes, alongside your other professional links.',
  },
  {
    q: 'Can I use the card for international networking?',
    a: 'Yes, your profile supports up to 12 languages.',
  },
]

export function FAQSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <section className="section faq" id="faq">
      <div className="container faq__grid">
        <div className="faq__head stagger">
          <SectionIntro num="06" label="Questions" />
          <h2 className="h2">
            Simple answers.
            <br />
            <span className="accent">No fine print.</span>
          </h2>
          <p className="lede">
            Taply is designed to work quietly in the background, so the conversation can stay in focus.
          </p>
        </div>

        <div className="accordion stagger">
          {FAQS.map((item, i) => {
            const open = openFaq === i
            return (
              <div className={`acc${open ? ' is-open' : ''}`} key={item.q}>
                <h3 className="acc__heading">
                  <button
                    type="button"
                    id={`faq-trigger-${i}`}
                    className="acc__trigger"
                    aria-expanded={open}
                    aria-controls={`faq-panel-${i}`}
                    onClick={() => setOpenFaq(open ? null : i)}
                  >
                    <span>{item.q}</span>
                    <span className="acc__icon" aria-hidden="true" />
                  </button>
                </h3>
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${i}`}
                  className="acc__panel"
                >
                  <div className="acc__inner">
                    <p>{item.a}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
