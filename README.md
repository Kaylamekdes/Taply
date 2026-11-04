# Taply website

Single-page marketing and sales site for the Taply Versatile Plastic NFC Smart Business Card (KES 5,500).
Built from the Taply Design and Implementation Specification and the Taply Brand Guideline.

**Stack:** React 19, Vite, TypeScript, custom CSS. No animation or UI libraries.

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```

## Assets (public/brand)

| File | Source |
| --- | --- |
| `taply-logo.png`, `taply-logo-reversed.png`, `taply-symbol.png` | Extracted unaltered from the vector artwork in the Taply Brand Guideline PDF (transparent background). Replace with the official export files if you have them. |
| `networking.jpg` | **Placeholder.** The Unsplash photo named in the spec (Dwayne Joe, `photo-1776039324973-de7759e5096b`) could not be downloaded in the build environment, so the guideline's own "People between moments" photograph (credited there to Leo Okuyama / Unsplash) is used. Overwrite this file with the optimised Dwayne Joe image (about 1800×1200, under 300 KB); no code change needed. Update the credit accordingly. |

### Logo deviation (authorised)

The symbol in `taply-logo.png` and `taply-logo-reversed.png` has been enlarged by 17% so it sits at a
similar visual weight to the wordmark. This was explicitly authorised by the site owner as an exception to
the "never modify the logo" rule. Only the symbol was scaled (Lanczos) and repositioned: it stays
vertically centred on the wordmark, the gap between symbol and wordmark scales with it, and nothing was
recoloured, redrawn, skewed or given effects. The wordmark pixels are untouched. The canvas grew from
1649×453 to 1738×453; `BrandMark` and the fixed-width logo slots were updated to match.

- Originals: `public/brand/originals/`
- Script: `python scripts/resize-logo-symbol.py [scale]` (always reads from the originals, default scale 1.17)
- If official export files arrive, ask the brand owner for a lockup with the larger symbol rather than
  re-running the script on them, since raster upscaling slightly softens the symbol.

## Notes

- Fonts (Manrope, DM Mono) are self-hosted through Fontsource instead of the Google Fonts `@import`; same families and weights.
- Nav, hero and final CTAs scroll to `#pricing`. The pricing CTA and footer link go to `https://taply.com`, the only confirmed purchase destination. No checkout is built.
- The Amara Mensah profile is the sample from the brand guideline, labelled as a product demonstration, not a testimonial.
- Nothing is invented beyond the spec's confirmed facts (no delivery, warranty, payment, dimension or contact details).
