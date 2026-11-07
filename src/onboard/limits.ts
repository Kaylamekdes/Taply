/*
 * Limits shared by the onboarding form (src/onboard) and its API (api/).
 * Pure data and string helpers only: no DOM and no Node APIs.
 */

/** Field length limits (characters). */
export const MAX = {
  name: 80,
  title: 80,
  company: 100,
  phone: 24,
  email: 120,
  url: 300,
  city: 60,
  tagline: 60,
  bio: 200,
  linkLabel: 40,
  languagesOther: 120,
  notes: 1000,
} as const

export const MAX_EXTRA_LINKS = 3
export const MAX_COLOURS = 3
export const MAX_CARD_FILES = 2
export const MAX_FILES = 5 // logo + photo + 2 card sides, with one spare
/** After client-side processing, all files together (stays under Vercel's 4.5MB body limit). */
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024
/** Any single file. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024
/** Seconds a person needs at minimum to fill in the form (spam check). */
export const MIN_FILL_SECONDS = 8

export const LANGUAGES = [
  'English',
  'Kiswahili',
  'French',
  'Arabic',
  'Somali',
  'Amharic',
  'Spanish',
  'Portuguese',
  'German',
  'Italian',
  'Mandarin',
  'Hindi',
] as const

export type ExtraLink = { label: string; url: string }

/** Every text value the form sends (files are sent separately). */
export type Brief = {
  name: string
  title: string
  company: string
  phone: string
  whatsapp: string
  whatsappSame: boolean
  email: string
  website: string
  city: string
  tagline: string
  bio: string
  linkedin: string
  instagram: string
  links: ExtraLink[]
  languages: string[]
  languagesOther: string
  colours: string[]
  notes: string
  consent: boolean
}

export const EMPTY_BRIEF: Brief = {
  name: '',
  title: '',
  company: '',
  phone: '',
  whatsapp: '',
  whatsappSame: true,
  email: '',
  website: '',
  city: '',
  tagline: '',
  bio: '',
  linkedin: '',
  instagram: '',
  links: [],
  languages: [],
  languagesOther: '',
  colours: [],
  notes: '',
  consent: false,
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** Digits only, 7-15 of them (an optional leading + and spaces/dashes allowed). */
export function isPhone(v: string): boolean {
  if (!/^\+?[\d\s()-]+$/.test(v)) return false
  const digits = v.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

/** Accepts "example.com" or "https://example.com"; rejects anything that isn't http(s). */
export function isWebUrl(v: string): boolean {
  const s = /^[a-z][a-z\d+.-]*:/i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(s)
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.')
  } catch {
    return false
  }
}

/** Instagram: a handle (@name) or a URL. */
export function isHandleOrUrl(v: string): boolean {
  return /^@?[A-Za-z0-9._]{1,30}$/.test(v) || isWebUrl(v)
}

export type FieldErrors = Partial<Record<string, string>>

/**
 * Validates one step (1-3) or, with step 0, everything. Used by the form for
 * inline errors and by the server before anything is emailed.
 */
export function validateBrief(b: Brief, step: 0 | 1 | 2 | 3 = 0): FieldErrors {
  const e: FieldErrors = {}
  const req = (k: keyof Brief, label: string) => {
    if (!String(b[k] ?? '').trim()) e[k] = `Please enter your ${label}.`
  }
  const len = (k: string, v: string, max: number) => {
    if (v.length > max) e[k] = `Please keep this under ${max} characters.`
  }
  if (step === 0 || step === 1) {
    req('name', 'full name')
    req('title', 'job title')
    req('company', 'company name')
    req('phone', 'phone number')
    req('email', 'email address')
    if (b.phone.trim() && !isPhone(b.phone)) e.phone = 'Please enter a valid phone number, for example +254 712 345 678.'
    if (!b.whatsappSame && b.whatsapp.trim() && !isPhone(b.whatsapp)) e.whatsapp = 'Please enter a valid WhatsApp number.'
    if (b.email.trim() && !EMAIL_RE.test(b.email.trim())) e.email = 'Please enter a valid email address, like name@company.com.'
    if (b.website.trim() && !isWebUrl(b.website.trim())) e.website = 'Please enter a web address, like company.com.'
    len('name', b.name, MAX.name)
    len('title', b.title, MAX.title)
    len('company', b.company, MAX.company)
    len('email', b.email, MAX.email)
    len('website', b.website, MAX.url)
    len('city', b.city, MAX.city)
  }
  if (step === 0 || step === 2) {
    len('tagline', b.tagline, MAX.tagline)
    len('bio', b.bio, MAX.bio)
    if (b.linkedin.trim() && !isWebUrl(b.linkedin.trim())) e.linkedin = 'Please enter your LinkedIn profile address.'
    if (b.instagram.trim() && !isHandleOrUrl(b.instagram.trim())) e.instagram = 'Please enter an @handle or a profile address.'
    if (b.links.length > MAX_EXTRA_LINKS) e.links = `Up to ${MAX_EXTRA_LINKS} extra links.`
    b.links.forEach((l, i) => {
      if (l.url.trim() && !isWebUrl(l.url.trim())) e[`link${i}url`] = 'Please enter a web address.'
      if (l.url.trim() && !l.label.trim()) e[`link${i}label`] = 'Please add a label, like "Portfolio".'
      if (l.label.trim() && !l.url.trim()) e[`link${i}url`] = 'Please add the address for this link.'
      len(`link${i}label`, l.label, MAX.linkLabel)
      len(`link${i}url`, l.url, MAX.url)
    })
    if (b.languages.some((l) => !(LANGUAGES as readonly string[]).includes(l))) e.languages = 'Please choose from the list.'
    len('languagesOther', b.languagesOther, MAX.languagesOther)
    if (b.colours.length > MAX_COLOURS) e.colours = `Up to ${MAX_COLOURS} colours.`
    b.colours.forEach((c, i) => {
      if (!HEX_RE.test(c)) e[`colour${i}`] = 'Please use a hex value, like #4C1BF1.'
    })
    len('notes', b.notes, MAX.notes)
  }
  if (step === 0 || step === 3) {
    if (!b.consent) e.consent = 'Please tick this box so we can use your details to make your card.'
  }
  return e
}
