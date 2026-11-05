import { BrandMark, ORDER_URL } from './shared'

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <BrandMark variant="reversed" alt="Taply" className="footer__logo" />
            <p>A smarter, more memorable way to share your professional identity.</p>
          </div>

          <nav aria-label="Explore">
            <h2 className="mono-label footer__h">Explore</h2>
            <ul>
              <li>
                <a href="#how">How it works</a>
              </li>
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <a href="#faq">FAQ</a>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="mono-label footer__h">Taply</h2>
            <ul>
              <li>
                <a href={ORDER_URL} target="_blank" rel="noreferrer">
                  taply.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <p>© 2026 Taply. All rights reserved.</p>
          <p>Digital identity, made human.</p>
        </div>
      </div>
    </footer>
  )
}
