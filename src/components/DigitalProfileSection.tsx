import { SectionIntro } from './shared'
import { ProductCard } from './ProductCard'
import { ProfilePhone } from './ProfilePhone'

const LIST = [
  'Phone & WhatsApp',
  'Email & website',
  'LinkedIn & Instagram',
  'Other relevant links',
  'One-tap contact saving',
]

export function DigitalProfileSection() {
  return (
    <section className="section profile" id="profile" data-loop>
      <div className="container profile__grid">
        <div className="profile__copy stagger">
          <SectionIntro num="04" label="Your profile" tone="lime" dark />
          <h2 className="h2">
            Your profile is <span className="accent-lime">live.</span>
          </h2>
          <p className="lede">
            Your details, story and links, in one place.
          </p>
          <ul className="profile__list">
            {LIST.map((item) => (
              <li key={item}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="m3.5 9.5 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="profile__visual trigger">
          <div className="pstage">
            <span className="pstage__field" aria-hidden="true" data-parallax="0.06" />
            <div className="pstage__phone">
              <ProfilePhone />
            </div>
            <div className="pstage__card">
              <div className="float float--late">
                <ProductCard variant="dark" />
              </div>
            </div>
            <p className="pstage__note">Product demonstration · sample profile</p>
          </div>
        </div>
      </div>
    </section>
  )
}
