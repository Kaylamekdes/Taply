import type { CSSProperties, ReactNode } from 'react'
import { SectionIntro } from './shared'

const ICONS: Record<string, ReactNode> = {
  tap: (
    <>
      <circle pathLength={1} cx="7" cy="17" r="2" />
      <path pathLength={1} d="M7 11a6 6 0 0 1 6 6M7 5.5a11.5 11.5 0 0 1 11.5 11.5" />
    </>
  ),
  scan: (
    <>
      <path pathLength={1} d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
      <path pathLength={1} d="M8 12h8" />
    </>
  ),
  profile: (
    <>
      <circle pathLength={1} cx="12" cy="8.5" r="3.5" />
      <path pathLength={1} d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" />
    </>
  ),
  save: (
    <>
      <circle pathLength={1} cx="10" cy="8.5" r="3.5" />
      <path pathLength={1} d="M3.5 20c.8-3.8 3.4-6 6.5-6M17 14v6M14 17h6" />
    </>
  ),
  current: <path pathLength={1} d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.5l1.7-2M20 20v-4.5h-4.5" />,
  links: (
    <path pathLength={1} d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  ),
  home: (
    <>
      <rect pathLength={1} x="7" y="3" width="10" height="18" rx="2" />
      <path pathLength={1} d="M12 9v6M9 12h6" />
    </>
  ),
  globe: (
    <>
      <circle pathLength={1} cx="12" cy="12" r="8.5" />
      <path pathLength={1} d="M3.5 12h17M12 3.5c2.5 2.4 3.7 5.2 3.7 8.5s-1.2 6.1-3.7 8.5c-2.5-2.4-3.7-5.2-3.7-8.5S9.5 5.9 12 3.5z" />
    </>
  ),
  analytics: (
    <>
      <path pathLength={1} d="M4 19V5M4 19h16" />
      <path pathLength={1} d="m8 14 3.5-4 3 2.5L19 7" />
    </>
  ),
}

const FEATURES = [
  { icon: 'tap', title: 'Tap to share', text: 'A quick NFC tap opens your profile on compatible smartphones.', violet: true },
  { icon: 'scan', title: 'Scan to connect', text: 'A built-in QR code keeps every introduction within reach.' },
  { icon: 'profile', title: 'Your digital profile', text: 'Your contact details, role and useful links in one place.' },
  { icon: 'save', title: 'Save contact', text: 'People save your details without typing anything in.' },
  { icon: 'current', title: 'Always current', text: 'Update your digital details without printing another physical card.', violet: true },
  { icon: 'links', title: 'Links that matter', text: 'Add your phone, WhatsApp, email, website and social profiles.' },
  { icon: 'home', title: 'Ready on their home screen', text: 'People can add your profile to their phone’s home screen.' },
  { icon: 'globe', title: 'Up to 12 languages', text: 'Meet people across borders with a multilingual profile.' },
  { icon: 'analytics', title: 'Optional analytics', text: 'Where enabled, understand how your profile is being viewed.' },
]

export function FeaturesSection() {
  return (
    <section className="section features" id="features">
      <div className="container">
        <div className="features__head stagger">
          <SectionIntro num="03" label="What you get" tone="lime" dark />
          <h2 className="h2">
            More than a business card. <span className="muted">Your professional identity in one place.</span>
          </h2>
        </div>

        <ul className="fgrid">
          {FEATURES.map((f, i) => (
            <li
              key={f.title}
              className={`feature reveal${f.violet ? ' feature--violet' : ''}`}
              style={{ '--d': `${(i % 3) * 80}ms` } as CSSProperties}
            >
              <p className="mono-label feature__num">{String(i + 1).padStart(2, '0')}</p>
              <svg className="feature__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {ICONS[f.icon]}
              </svg>
              <h3 className="feature__title">{f.title}</h3>
              <p className="feature__text">{f.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
