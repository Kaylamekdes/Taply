import { BrandMark } from './shared'

// A stylised, decorative QR-style pattern. It is artwork, not a scannable code.
const QR_SIZE = 17
const QR_CELLS: [number, number][] = (() => {
  const cells: [number, number][] = []
  let seed = 7
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x > QR_SIZE - 8 && y < 7) || (x < 7 && y > QR_SIZE - 8)
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      if (!inFinder(x, y) && rand() > 0.52) cells.push([x, y])
    }
  }
  return cells
})()

function QrGlyph({ className }: { className?: string }) {
  const finder = (ox: number, oy: number) => (
    <g key={`${ox}-${oy}`}>
      <rect x={ox} y={oy} width="7" height="7" fill="currentColor" />
      <rect x={ox + 1} y={oy + 1} width="5" height="5" fill="var(--qr-bg)" />
      <rect x={ox + 2} y={oy + 2} width="3" height="3" fill="currentColor" />
    </g>
  )
  return (
    <svg className={className} viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} aria-hidden="true" shapeRendering="crispEdges">
      {finder(0, 0)}
      {finder(QR_SIZE - 7, 0)}
      {finder(0, QR_SIZE - 7)}
      {QR_CELLS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  )
}

export function NfcIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 8.2a5.6 5.6 0 0 1 0 7.6M11.4 5.6a9.6 9.6 0 0 1 0 12.8M14.8 3a13.6 13.6 0 0 1 0 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

type ProductCardProps = {
  variant: 'dark' | 'light'
  className?: string
}

/**
 * A physical Taply card (~1.586 ratio). Sized by its parent's width; all inner
 * dimensions use container units so it scales cleanly from mini to hero size.
 */
export function ProductCard({ variant, className = '' }: ProductCardProps) {
  return (
    <div className={`pcard pcard--${variant} ${className}`} aria-hidden="true">
      <div className="pcard__face">
        {variant === 'dark' ? (
          <>
            <BrandMark variant="reversed" className="pcard__logo" />
            <span className="pcard__label">Tap to connect</span>
            <NfcIcon className="pcard__nfc" />
          </>
        ) : (
          <>
            <BrandMark variant="logo" className="pcard__logo" />
            <span className="pcard__label">Scan to connect</span>
            <QrGlyph className="pcard__qr" />
          </>
        )}
        <span className="pcard__gloss" />
      </div>
    </div>
  )
}
