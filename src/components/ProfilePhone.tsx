import { Arrow } from './shared'

const LINKS = ['Phone', 'WhatsApp', 'Email', 'LinkedIn', 'Instagram', 'Website']

type ProfilePhoneProps = {
  /** Number of contact link rows to show (miniature versions show fewer). */
  rows?: number
  className?: string
  /** Decorative miniature: hidden from assistive tech. */
  decorative?: boolean
}

/**
 * Product demonstration of a Taply profile. The person shown is a sample from
 * the brand guideline, not a customer or testimonial.
 */
export function ProfilePhone({ rows = LINKS.length, className = '', decorative = false }: ProfilePhoneProps) {
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': 'Sample Taply profile for Amara Mensah, Product Designer, with a Save contact button and contact links' }

  return (
    <div className={`phone ${className}`} {...a11y}>
      <div className="phone__frame" aria-hidden="true">
        <div className="phone__screen">
          <div className="phone__cover">
            <span className="phone__time">9:41</span>
            <span className="phone__island" />
            <span className="phone__leaf" />
          </div>

          <div className="phone__body">
            <div className="phone__avatar">AM</div>
            <span className="phone__status">
              <i /> Profile live
            </span>
            <p className="phone__role">Product designer</p>
            <p className="phone__name">Amara Mensah</p>
            <p className="phone__bio">Building useful things with thoughtful people.</p>

            <span className="phone__save">
              <span>Save contact</span>
              <span className="phone__save-arrow">
                <Arrow />
              </span>
            </span>

            <ul className="phone__links">
              {LINKS.slice(0, rows).map((label) => (
                <li key={label}>
                  <span>{label}</span>
                  <Arrow />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
