import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FocusEvent, FormEvent, ReactNode } from 'react'
import { BrandMark, CTA, SectionIntro, WHATSAPP_NUMBER } from '../components/shared'
import { CardBody, FlipButton } from '../components/YourCardSection'
import { EMPTY_BRIEF, LANGUAGES, MAX, MAX_CARD_FILES, MAX_COLOURS, MAX_EXTRA_LINKS, MAX_TOTAL_BYTES, validateBrief } from './limits'
import type { Brief, FieldErrors } from './limits'
import { formatBytes, prepare, SLOT_ACCEPT, SLOT_LABEL } from './files'
import type { Prepared, Slot } from './files'
import './onboard.css'

/*
 * Private client onboarding form (/onboard?t=<signed token>).
 * Not linked from the public site; noindex. The token is checked by
 * /api/verify before the form renders, and again by /api/submit.
 */

const wa = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
const LINK_HELP = wa("Hi Taply! My form link isn't working. Kindly send a new one.")
const SETUP_HELP = wa("Hi Taply! I tried to send my card details through the form, but it isn't set up yet. Can you help?")

type Link = { ref: string; client: string }
type Screen =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'not-configured' }
  | { kind: 'form'; link: Link }
  | { kind: 'success'; link: Link; dev: boolean; firstName: string }

type Files = Record<Slot, Prepared[]>
const NO_FILES: Files = { logo: [], photo: [], card: [] }
const STEPS = [
  { num: '01', label: 'You', title: ['About ', 'you.'] },
  { num: '02', label: 'Your brand', title: ['Your brand and ', 'profile.'] },
  { num: '03', label: 'Your files', title: ['Your ', 'files.'] },
] as const

/** Which field shows which side of the preview card. */
const BACK_FIELDS = new Set(['name', 'title'])
const FRONT_FIELDS = new Set(['tagline', 'logo'])

// ---------------------------------------------------------------- storage (drafts)
const draftKey = (ref: string) => `taply-brief-draft:${ref}`
function loadDraft(ref: string): Brief | null {
  try {
    const raw = window.localStorage.getItem(draftKey(ref))
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<Brief>
    return { ...EMPTY_BRIEF, ...d, consent: false }
  } catch (e) {
    console.warn('[onboard] could not read the saved draft', e)
    return null
  }
}
function saveDraft(ref: string, b: Brief) {
  try {
    const { consent: _c, ...text } = b
    void _c
    window.localStorage.setItem(draftKey(ref), JSON.stringify(text))
  } catch (e) {
    console.warn('[onboard] could not save the draft', e)
  }
}
function clearDraft(ref: string) {
  try {
    window.localStorage.removeItem(draftKey(ref))
    window.localStorage.removeItem(startKey(ref))
  } catch (e) {
    console.warn('[onboard] could not clear the draft', e)
  }
}
/** When the visitor first opened this link: survives refreshes, so the minimum fill time counts from the first visit. */
const startKey = (ref: string) => `taply-brief-start:${ref}`
function firstOpened(ref: string): number {
  const now = Date.now()
  try {
    const saved = Number(window.localStorage.getItem(startKey(ref)))
    if (saved > 0 && saved <= now) return saved
    window.localStorage.setItem(startKey(ref), String(now))
  } catch (e) {
    console.warn('[onboard] could not read the start time', e)
  }
  return now
}

function useWide() {
  const q = '(min-width: 981px)'
  const [wide, setWide] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

// ---------------------------------------------------------------- page
export default function OnboardingPage() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('t'), [])
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' })

  useEffect(() => {
    if (!token) {
      setScreen({ kind: 'invalid' })
      return
    }
    let gone = false
    fetch(`/api/verify?t=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (gone) return
        if (r.ok && body.ok) setScreen({ kind: 'form', link: { ref: body.ref, client: body.client } })
        else if (body.reason === 'not-configured') setScreen({ kind: 'not-configured' })
        else setScreen({ kind: 'invalid' })
      })
      .catch((e) => {
        console.warn('[onboard] verify failed', e)
        if (!gone) setScreen({ kind: 'invalid' })
      })
    return () => {
      gone = true
    }
  }, [token])

  return (
    <div className="ob">
      <span className="ob__grid" aria-hidden="true" />
      <header className="container ob-top">
        <BrandMark variant="logo" alt="Taply" className="ob-top__logo" />
        {(screen.kind === 'form' || screen.kind === 'success') && (
          <p className="ob-top__for">
            Prepared for <strong>{screen.link.client}</strong>
          </p>
        )}
      </header>
      <main className="container ob-main" id="main">
        {screen.kind === 'loading' && (
          <p className="ob-loading" role="status">
            Checking your link…
          </p>
        )}
        {screen.kind === 'invalid' && (
          <Notice title="This link isn't active." line="Please ask the Taply team for a new one." cta="Message Taply on WhatsApp" href={LINK_HELP} />
        )}
        {screen.kind === 'not-configured' && (
          <Notice
            title="The form isn't set up yet."
            line="Your details have not been sent. Please message us on WhatsApp and we'll help you directly."
            cta="Message Taply on WhatsApp"
            href={SETUP_HELP}
          />
        )}
        {screen.kind === 'form' && (
          <BriefForm
            link={screen.link}
            token={token!}
            onDone={(dev, firstName) => setScreen({ kind: 'success', link: screen.link, dev, firstName })}
            onLinkInvalid={() => setScreen({ kind: 'invalid' })}
            onNotConfigured={() => setScreen({ kind: 'not-configured' })}
          />
        )}
        {screen.kind === 'success' && <Success link={screen.link} dev={screen.dev} firstName={screen.firstName} />}
      </main>
    </div>
  )
}

function Notice({ title, line, cta, href }: { title: string; line: string; cta: string; href: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <section className="ob-screen ob-fade">
      <h1 className="h2 ob-screen__title" tabIndex={-1} ref={ref}>
        {title}
      </h1>
      <p className="lede">{line}</p>
      <div className="ob-screen__cta">
        <CTA href={href} variant="violet" external srNote=" (opens WhatsApp in a new tab)">
          {cta}
        </CTA>
      </div>
    </section>
  )
}

function Success({ link, dev, firstName }: { link: Link; dev: boolean; firstName: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus()
    window.scrollTo({ top: 0 })
  }, [])
  return (
    <section className="ob-screen ob-fade" aria-labelledby="ob-done">
      {dev && <p className="ob-dev">DEV MODE: not emailed</p>}
      <p className="eyebrow">
        <span className="eyebrow__num">✓</span>
        <span>— Brief received</span>
        <span className="eyebrow__rule eyebrow__rule--violet" aria-hidden="true" />
      </p>
      <h1 className="h2 ob-screen__title" id="ob-done" tabIndex={-1} ref={ref}>
        Thank you{firstName ? `, ${firstName}` : ''}. <span className="accent">We're on it.</span>
      </h1>
      <p className="ob-ref">
        <span className="ob-ref__k">Reference</span>
        <span className="ob-ref__v">{link.ref}</span>
      </p>
      <h2 className="ob-next__title">What happens next</h2>
      <ol className="ob-next">
        <li>
          <span className="ob-next__n">01</span>
          <span>We design your digital profile and card mockup. Your digital profile is ready within hours.</span>
        </li>
        <li>
          <span className="ob-next__n">02</span>
          <span>You approve the mockup.</span>
        </li>
        <li>
          <span className="ob-next__n">03</span>
          <span>We print your card. Printing takes 2 days after you approve the mockup.</span>
        </li>
      </ol>
      <p className="ob-store">We don't keep your details or files on our server: they go straight to the Taply team by email.</p>
      <div className="ob-screen__cta">
        <CTA href={wa(`Hi Taply! I have a question about my card brief (${link.ref}).`)} variant="violet" external srNote=" (opens WhatsApp in a new tab)">
          Questions? Message us on WhatsApp
        </CTA>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- form
type FormProps = {
  link: Link
  token: string
  onDone: (dev: boolean, firstName: string) => void
  onLinkInvalid: () => void
  onNotConfigured: () => void
}

function BriefForm({ link, token, onDone, onLinkInvalid, onNotConfigured }: FormProps) {
  const restored = useMemo(() => loadDraft(link.ref), [link.ref])
  const [brief, setBrief] = useState<Brief>(restored ?? EMPTY_BRIEF)
  const [files, setFiles] = useState<Files>(NO_FILES)
  const [fileErr, setFileErr] = useState<Partial<Record<Slot | 'total', string>>>({})
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [announce, setAnnounce] = useState(restored ? 'We restored the details you typed earlier.' : '')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [hp, setHp] = useState('')
  const startedAt = useRef(firstOpened(link.ref))
  const headingRef = useRef<HTMLHeadingElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const firstRender = useRef(true)
  const wide = useWide()

  // Draft: typed text only (never files), saved shortly after each change.
  useEffect(() => {
    const id = window.setTimeout(() => saveDraft(link.ref, brief), 400)
    return () => window.clearTimeout(id)
  }, [brief, link.ref])

  // Re-validate live once a step has been checked.
  useEffect(() => {
    if (checked[step]) setErrors(validateBrief(brief, step as 1 | 2 | 3))
  }, [brief, step, checked])

  // Move focus to the step's heading on every step change (not on first load).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus({ preventScroll: true })
    formRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [step])

  // Object URLs for thumbnails are released when files go away.
  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(() => () => Object.values(filesRef.current).flat().forEach((f) => f.url && URL.revokeObjectURL(f.url)), [])

  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => setBrief((b) => ({ ...b, [k]: v }))
  const onText = (k: keyof Brief) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never)

  const totalBytes = Object.values(files).flat().reduce((n, f) => n + f.file.size, 0)

  const checkStep = (s: 1 | 2 | 3): boolean => {
    const e = validateBrief(brief, s)
    setChecked((c) => ({ ...c, [s]: true }))
    setErrors(e)
    const keys = Object.keys(e)
    let fileProblem = false
    if (s === 3 && totalBytes > MAX_TOTAL_BYTES) fileProblem = true
    if (!keys.length && !fileProblem) return true
    const n = keys.length + (fileProblem ? 1 : 0)
    setAnnounce(`Please check ${n} ${n === 1 ? 'field' : 'fields'} before you continue.`)
    window.setTimeout(() => {
      const first = keys.length ? formRef.current?.querySelector<HTMLElement>(`[data-field="${keys[0]}"]`) : formRef.current?.querySelector<HTMLElement>('.ob-drop__input')
      first?.focus()
    }, 30)
    return false
  }

  const next = () => {
    if (!checkStep(step as 1 | 2)) return
    setAnnounce(`Step ${step + 1} of 3: ${STEPS[step].label}.`)
    setStep(step + 1)
  }
  const back = () => {
    setAnnounce(`Step ${step - 1} of 3: ${STEPS[step - 2].label}.`)
    setStep(step - 1)
  }

  // ---- files
  const addFiles = async (slot: Slot, list: FileList | File[]) => {
    const incoming = Array.from(list)
    if (!incoming.length) return
    const limit = slot === 'card' ? MAX_CARD_FILES : 1
    const room = slot === 'card' ? limit - files.card.length : 1
    if (room <= 0) {
      setFileErr((e) => ({ ...e, [slot]: 'You can upload up to 2 files here: the front and the back. Remove one to add another.' }))
      return
    }
    const take = incoming.slice(0, room)
    const problems: string[] = []
    if (incoming.length > room) problems.push(slot === 'card' ? 'Only 2 files fit here (front and back).' : 'Only one file fits here; we used the first.')
    const ok: Prepared[] = []
    for (const f of take) {
      try {
        ok.push(await prepare(f, slot))
      } catch (err) {
        problems.push((err as Error).message)
      }
    }
    setFiles((cur) => {
      const replaced = slot === 'card' ? [] : cur[slot]
      replaced.forEach((p) => p.url && URL.revokeObjectURL(p.url))
      return { ...cur, [slot]: slot === 'card' ? [...cur.card, ...ok] : ok.length ? ok : cur[slot] }
    })
    setFileErr((e) => ({ ...e, [slot]: problems.join(' ') || undefined }))
    setAnnounce(problems.length ? problems.join(' ') : `${ok.map((p) => p.name).join(', ')} added to your ${SLOT_LABEL[slot]}.`)
    if (slot === 'logo' && ok.length) setSide('front')
  }
  const removeFile = (slot: Slot, id: string) => {
    setFiles((cur) => {
      cur[slot].filter((p) => p.id === id).forEach((p) => p.url && URL.revokeObjectURL(p.url))
      return { ...cur, [slot]: cur[slot].filter((p) => p.id !== id) }
    })
    setFileErr((e) => ({ ...e, [slot]: undefined }))
    setAnnounce(`File removed from your ${SLOT_LABEL[slot]}.`)
  }

  // Which file to shrink when everything together is over the limit.
  const totalError = useMemo(() => {
    if (totalBytes <= MAX_TOTAL_BYTES) return ''
    const biggest = Object.values(files)
      .flat()
      .sort((a, b) => b.file.size - a.file.size)[0]
    return `Your files add up to ${formatBytes(totalBytes)}, over the 4 MB limit. Please use a smaller ${SLOT_LABEL[biggest.slot]} ("${biggest.name}", ${formatBytes(biggest.file.size)}).`
  }, [files, totalBytes])

  // ---- submit
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (step < 3) return next()
    if (sending) return
    if (!checkStep(3)) return
    setSending(true)
    setSendError('')
    setAnnounce('Sending your details…')
    const fd = new FormData()
    const payload: Brief = { ...brief, whatsapp: brief.whatsappSame ? brief.phone : brief.whatsapp }
    fd.append('brief', JSON.stringify(payload))
    fd.append('elapsed', String(Math.round((Date.now() - startedAt.current) / 1000)))
    fd.append('fax', hp)
    for (const p of [...files.logo, ...files.photo, ...files.card]) fd.append(p.slot, p.file, p.file.name)
    try {
      const r = await fetch('/api/submit', { method: 'POST', headers: { 'x-taply-token': token }, body: fd })
      const body = await r.json().catch(() => ({}))
      if (r.ok && body.ok) {
        clearDraft(link.ref)
        onDone(!!body.dev, brief.name.trim().split(/\s+/)[0] ?? '')
        return
      }
      if (r.status === 401) return onLinkInvalid()
      if (body.error === 'not-configured') return onNotConfigured()
      if (body.error === 'invalid' && body.fields) {
        const fields = body.fields as FieldErrors
        setErrors(fields)
        setChecked({ 1: true, 2: true, 3: true })
        const k = Object.keys(fields)[0]
        const s = validateBrief(brief, 1)[k] ? 1 : validateBrief(brief, 2)[k] ? 2 : 3
        setStep(s)
        setAnnounce(body.message || 'Please check the highlighted fields.')
        setSending(false)
        return
      }
      if (body.error === 'file' && body.file) {
        setFileErr((fe) => ({ ...fe, [body.file]: body.message }))
      }
      setSendError(body.message || "We couldn't send your details just now. Please try again.")
      setAnnounce(body.message || "We couldn't send your details just now.")
    } catch (err) {
      console.warn('[onboard] submit failed', err)
      setSendError("We couldn't reach our server. Please check your connection and try again.")
      setAnnounce("We couldn't reach our server. Please try again.")
    }
    setSending(false)
  }

  // ---- preview side follows the field being edited
  const onFocusCapture = (e: FocusEvent<HTMLFormElement>) => {
    const f = (e.target as HTMLElement).dataset.field
    if (f && BACK_FIELDS.has(f)) setSide('back')
    else if (f && FRONT_FIELDS.has(f)) setSide('front')
  }

  const preview = (
    <Preview
      brief={brief}
      logoUrl={files.logo[0]?.url ?? null}
      side={side}
      onSide={setSide}
    />
  )

  const err = (k: string) => errors[k]
  const meta = STEPS[step - 1]

  return (
    <>
      <div className="ob-head">
        <h1 className="h2 ob-head__title">
          Let's build <span className="accent">your card.</span>
        </h1>
        <p className="lede">Tell us about you and upload your files. We'll take it from here.</p>
      </div>

      <div className="ob-layout">
        <form className="ob-form" ref={formRef} onSubmit={submit} onFocusCapture={onFocusCapture} noValidate aria-describedby="ob-steps-label">
          <div className="ob-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${step / 3})` }} />
          </div>
          <p className="ob-steps" id="ob-steps-label">
            Step {step} of 3
          </p>
          <p className="sr-only" aria-live="polite" role="status">
            {announce}
          </p>

          {/* Honeypot: people never see or reach this field. */}
          <div className="ob-hp" aria-hidden="true">
            <label>
              Fax
              <input name="fax" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
            </label>
          </div>

          <div className="ob-step" key={step}>
            <SectionIntro num={meta.num} label={meta.label} />
            <h2 className="ob-step__title" tabIndex={-1} ref={headingRef}>
              {meta.title[0]}
              <span className="accent">{meta.title[1]}</span>
            </h2>

            {step === 1 && (
              <div className="ob-fields">
                <Field id="name" label="Full name" required error={err('name')}>
                  {(p) => <input {...p} className="ob-input" type="text" autoComplete="name" maxLength={MAX.name} value={brief.name} onChange={onText('name')} />}
                </Field>
                <Field id="title" label="Job title" required error={err('title')}>
                  {(p) => <input {...p} className="ob-input" type="text" autoComplete="organization-title" maxLength={MAX.title} value={brief.title} onChange={onText('title')} />}
                </Field>
                <Field id="company" label="Company name" required error={err('company')} full>
                  {(p) => <input {...p} className="ob-input" type="text" autoComplete="organization" maxLength={MAX.company} value={brief.company} onChange={onText('company')} />}
                </Field>
                <Field id="phone" label="Phone" required error={err('phone')}>
                  {(p) => <input {...p} className="ob-input" type="tel" autoComplete="tel" inputMode="tel" maxLength={MAX.phone} value={brief.phone} onChange={onText('phone')} />}
                </Field>
                <div className="ob-field">
                  {!brief.whatsappSame ? (
                    <Field id="whatsapp" label="WhatsApp number" error={err('whatsapp')} bare>
                      {(p) => <input {...p} className="ob-input" type="tel" autoComplete="tel" inputMode="tel" maxLength={MAX.phone} value={brief.whatsapp} onChange={onText('whatsapp')} />}
                    </Field>
                  ) : (
                    <span className="ob-label" aria-hidden="true">
                      WhatsApp number
                    </span>
                  )}
                  <label className="ob-check ob-check--inline">
                    <input type="checkbox" checked={brief.whatsappSame} onChange={(e) => set('whatsappSame', e.target.checked)} />
                    <span>WhatsApp: same as phone</span>
                  </label>
                </div>
                <Field id="email" label="Email" required error={err('email')} full>
                  {(p) => <input {...p} className="ob-input" type="email" autoComplete="email" inputMode="email" maxLength={MAX.email} value={brief.email} onChange={onText('email')} />}
                </Field>
                <Field id="website" label="Website" error={err('website')}>
                  {(p) => <input {...p} className="ob-input" type="url" autoComplete="url" inputMode="url" placeholder="company.com" maxLength={MAX.url} value={brief.website} onChange={onText('website')} />}
                </Field>
                <Field id="city" label="City" error={err('city')}>
                  {(p) => <input {...p} className="ob-input" type="text" autoComplete="address-level2" maxLength={MAX.city} value={brief.city} onChange={onText('city')} />}
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="ob-fields">
                <Field id="tagline" label="Card front line" hint="A short tagline or line under your logo" error={err('tagline')} full counter={`${brief.tagline.length} / ${MAX.tagline}`}>
                  {(p) => <input {...p} className="ob-input" type="text" maxLength={MAX.tagline} value={brief.tagline} onChange={onText('tagline')} />}
                </Field>
                <Field id="bio" label="Short bio" error={err('bio')} full counter={`${brief.bio.length} / ${MAX.bio}`}>
                  {(p) => <textarea {...p} className="ob-input ob-textarea" rows={3} maxLength={MAX.bio} value={brief.bio} onChange={onText('bio')} />}
                </Field>
                <Field id="linkedin" label="LinkedIn" error={err('linkedin')}>
                  {(p) => <input {...p} className="ob-input" type="url" inputMode="url" placeholder="linkedin.com/in/…" maxLength={MAX.url} value={brief.linkedin} onChange={onText('linkedin')} />}
                </Field>
                <Field id="instagram" label="Instagram" error={err('instagram')}>
                  {(p) => <input {...p} className="ob-input" type="text" inputMode="url" autoCapitalize="none" placeholder="@handle" maxLength={MAX.url} value={brief.instagram} onChange={onText('instagram')} />}
                </Field>

                <fieldset className="ob-field ob-field--full ob-set">
                  <legend className="ob-label">
                    Other links <span className="ob-opt">(up to {MAX_EXTRA_LINKS})</span>
                  </legend>
                  {brief.links.map((l, i) => (
                    <div className="ob-row" key={i}>
                      <Field id={`link${i}label`} label={`Link ${i + 1} label`} error={err(`link${i}label`)} bare>
                        {(p) => (
                          <input {...p} className="ob-input" type="text" placeholder="Portfolio" maxLength={MAX.linkLabel} value={l.label}
                            onChange={(e) => set('links', brief.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                        )}
                      </Field>
                      <Field id={`link${i}url`} label={`Link ${i + 1} address`} error={err(`link${i}url`)} bare>
                        {(p) => (
                          <input {...p} className="ob-input" type="url" inputMode="url" placeholder="example.com" maxLength={MAX.url} value={l.url}
                            onChange={(e) => set('links', brief.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                        )}
                      </Field>
                      <button type="button" className="ob-remove" aria-label={`Remove link ${i + 1}`} onClick={() => set('links', brief.links.filter((_, j) => j !== i))}>
                        <Cross />
                      </button>
                    </div>
                  ))}
                  {brief.links.length < MAX_EXTRA_LINKS && (
                    <button type="button" className="ob-add" onClick={() => set('links', [...brief.links, { label: '', url: '' }])}>
                      + Add a link
                    </button>
                  )}
                </fieldset>

                <fieldset className="ob-field ob-field--full ob-set">
                  <legend className="ob-label">
                    Profile languages <span className="ob-opt">(choose any)</span>
                  </legend>
                  <div className="ob-chips">
                    {LANGUAGES.map((lang) => {
                      const on = brief.languages.includes(lang)
                      return (
                        <button type="button" key={lang} className="ob-chip" aria-pressed={on}
                          onClick={() => set('languages', on ? brief.languages.filter((x) => x !== lang) : [...brief.languages, lang])}>
                          {lang}
                        </button>
                      )
                    })}
                  </div>
                  <Field id="languagesOther" label="Other languages" error={err('languagesOther')} bare>
                    {(p) => <input {...p} className="ob-input" type="text" maxLength={MAX.languagesOther} value={brief.languagesOther} onChange={onText('languagesOther')} />}
                  </Field>
                </fieldset>

                <fieldset className="ob-field ob-field--full ob-set">
                  <legend className="ob-label">
                    Brand colours <span className="ob-opt">(optional, up to {MAX_COLOURS})</span>
                  </legend>
                  <div className="ob-colours">
                    {brief.colours.map((c, i) => (
                      <div className="ob-colour" key={i}>
                        <input type="color" className="ob-colour__pick" aria-label={`Colour ${i + 1} picker`} value={/^#[0-9a-f]{6}$/i.test(c) ? c : '#000000'}
                          onChange={(e) => set('colours', brief.colours.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)))} />
                        <Field id={`colour${i}`} label={`Colour ${i + 1} hex value`} error={err(`colour${i}`)} bare srLabel>
                          {(p) => (
                            <input {...p} className="ob-input ob-colour__hex" type="text" spellCheck={false} autoCapitalize="characters" maxLength={7} value={c}
                              onChange={(e) => set('colours', brief.colours.map((x, j) => (j === i ? e.target.value : x)))} />
                          )}
                        </Field>
                        <button type="button" className="ob-remove" aria-label={`Remove colour ${i + 1}`} onClick={() => set('colours', brief.colours.filter((_, j) => j !== i))}>
                          <Cross />
                        </button>
                      </div>
                    ))}
                  </div>
                  {brief.colours.length < MAX_COLOURS && (
                    <button type="button" className="ob-add" onClick={() => set('colours', [...brief.colours, brief.colours.length ? '#13131F' : '#4C1BF1'])}>
                      + Add a colour
                    </button>
                  )}
                </fieldset>

                <Field id="notes" label="Anything else we should know" error={err('notes')} full>
                  {(p) => <textarea {...p} className="ob-input ob-textarea" rows={4} maxLength={MAX.notes} value={brief.notes} onChange={onText('notes')} />}
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="ob-fields ob-fields--files">
                <Upload slot="logo" label="Logo" hint="PNG, SVG, JPG or WebP. A vector SVG or high-resolution PNG is best." files={files.logo} error={fileErr.logo} onAdd={addFiles} onRemove={removeFile} />
                <Upload slot="photo" label="Profile photo" hint="JPG, PNG or WebP." files={files.photo} error={fileErr.photo} onAdd={addFiles} onRemove={removeFile} />
                <Upload slot="card" label="Business card" optional multiple
                  hint="Already have a business card? Upload it and we'll copy the details for you. Up to 2 files (front and back), as images or PDF."
                  files={files.card} error={fileErr.card} onAdd={addFiles} onRemove={removeFile} />
                {totalError && (
                  <p className="ob-error ob-field--full" role="alert">
                    <Bang />
                    {totalError}
                  </p>
                )}
                <div className="ob-field ob-field--full">
                  <label className="ob-check">
                    <input type="checkbox" data-field="consent" checked={brief.consent} onChange={(e) => set('consent', e.target.checked)}
                      aria-invalid={!!err('consent')} aria-describedby={err('consent') ? 'consent-error' : undefined} required />
                    <span>I agree that Taply may use these details and files to design and produce my card and digital profile.</span>
                  </label>
                  {err('consent') && (
                    <p className="ob-error" id="consent-error">
                      <Bang />
                      {err('consent')}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {!wide && (
            <div className="ob-mpreview">
              <button type="button" className="ob-mpreview__toggle" aria-expanded={previewOpen} aria-controls="ob-mpreview" onClick={() => setPreviewOpen((o) => !o)}>
                Preview
                <span className="ob-mpreview__chev" aria-hidden="true" />
              </button>
              {previewOpen && (
                <div id="ob-mpreview" className="ob-mpreview__body">
                  {preview}
                </div>
              )}
            </div>
          )}

          {sendError && (
            <div className="ob-senderr" role="alert">
              <p>
                <Bang />
                {sendError}
              </p>
              <a href={wa(`Hi Taply! I'm having trouble sending my card details (${link.ref}).`)} target="_blank" rel="noopener noreferrer" className="ob-add">
                Message us on WhatsApp<span className="sr-only"> (opens WhatsApp in a new tab)</span>
              </a>
            </div>
          )}

          <div className="ob-actions">
            {step > 1 ? (
              <button type="button" className="ob-back" onClick={back}>
                <span aria-hidden="true">←</span> Back
              </button>
            ) : (
              <span />
            )}
            <CTA variant="violet" type="submit" disabled={sending} className="ob-next">
              {step < 3 ? 'Continue' : sending ? 'Sending…' : 'Send my details'}
            </CTA>
          </div>
        </form>

        {wide && (
          <aside className="ob-aside" aria-label="Live card preview">
            <p className="mono-label ob-aside__label">Live preview</p>
            {preview}
          </aside>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- preview
function Preview({ brief, logoUrl, side, onSide }: { brief: Brief; logoUrl: string | null; side: 'front' | 'back'; onSide: (s: 'front' | 'back') => void }) {
  const back = side === 'back'
  const [flips, setFlips] = useState(0)
  const prev = useRef(back)
  useEffect(() => {
    if (prev.current !== back) setFlips((n) => n + 1)
    prev.current = back
  }, [back])
  return (
    <div className="ob-preview">
      <div className={`ycard ycard--preview is-rest${back ? ' is-back' : ''}${flips ? ` is-flip-${flips % 2}` : ''}`}>
        <div className="ycard__view" onClick={() => onSide(back ? 'front' : 'back')} aria-hidden="true">
          <CardBody
            front={{ logoSrc: logoUrl ?? undefined, tagline: brief.tagline.trim() }}
            back={{ name: brief.name.trim() || 'Your name', role: brief.title.trim() || 'Job title' }}
          />
        </div>
        <FlipButton back={back} onClick={() => onSide(back ? 'front' : 'back')} />
      </div>
      <p className="ob-preview__note">A preview of your card. The QR code will open your digital profile.</p>
    </div>
  )
}

// ---------------------------------------------------------------- fields
type InputProps = {
  id: string
  'data-field': string
  'aria-invalid': boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  full,
  bare,
  srLabel,
  counter,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  full?: boolean
  bare?: boolean
  srLabel?: boolean
  counter?: string
  children: (p: InputProps) => ReactNode
}) {
  const describedBy = [hint && `${id}-hint`, counter && `${id}-count`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const body = (
    <>
      <label className={srLabel ? 'sr-only' : 'ob-label'} htmlFor={`f-${id}`}>
        {label}
        {required ? (
          <span className="ob-req" aria-hidden="true">
            {' '}
            *
          </span>
        ) : (
          !bare && <span className="ob-opt"> (optional)</span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children({ id: `f-${id}`, 'data-field': id, 'aria-invalid': !!error, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {(hint || counter) && (
        <div className="ob-hintrow">
          {hint && (
            <p className="ob-hint" id={`${id}-hint`}>
              {hint}
            </p>
          )}
          {counter && (
            <p className="ob-count" id={`${id}-count`}>
              {counter}
            </p>
          )}
        </div>
      )}
      {error && (
        <p className="ob-error" id={`${id}-error`}>
          <Bang />
          {error}
        </p>
      )}
    </>
  )
  if (bare) return <div className="ob-subfield">{body}</div>
  return <div className={`ob-field${full ? ' ob-field--full' : ''}`}>{body}</div>
}

function Upload({
  slot,
  label,
  hint,
  optional,
  multiple,
  files,
  error,
  onAdd,
  onRemove,
}: {
  slot: Slot
  label: string
  hint: string
  optional?: boolean
  multiple?: boolean
  files: Prepared[]
  error?: string
  onAdd: (slot: Slot, list: FileList | File[]) => void
  onRemove: (slot: Slot, id: string) => void
}) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = `file-${slot}`
  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setDrag(false)
      if (e.dataTransfer.files?.length) onAdd(slot, e.dataTransfer.files)
    },
    [onAdd, slot],
  )
  const describedBy = `${id}-hint${error ? ` ${id}-error` : ''}`
  return (
    <div className="ob-field ob-field--full">
      <span className="ob-label" id={`${id}-label`}>
        {label}
        {optional ? <span className="ob-opt"> (optional)</span> : <span className="ob-opt"> (recommended)</span>}
      </span>
      <label
        className={`ob-drop${drag ? ' is-drag' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false)
        }}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          id={id}
          className="ob-drop__input"
          type="file"
          accept={SLOT_ACCEPT[slot]}
          multiple={multiple}
          aria-labelledby={`${id}-label ${id}-cta`}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          onChange={(e) => {
            if (e.target.files) onAdd(slot, e.target.files)
            e.target.value = ''
          }}
        />
        <span className="ob-drop__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 15V4m0 0L6.5 8.5M11 4l4.5 4.5M4 15v3h14v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="ob-drop__text" id={`${id}-cta`}>
          Drag {multiple ? 'files' : 'a file'} here or <u>choose {multiple ? 'files' : 'a file'}</u>
        </span>
        <span className="ob-drop__hint" id={`${id}-hint`}>
          {hint}
        </span>
      </label>
      {files.length > 0 && (
        <ul className="ob-thumbs" aria-label={`${label} files`}>
          {files.map((f, i) => (
            <li key={f.id}>
              {f.url ? <img className={`ob-thumb ob-thumb--${slot}`} src={f.url} alt="" /> : <span className="ob-thumb ob-thumb--pdf">PDF</span>}
              <span className="ob-thumbs__meta">
                <span className="ob-thumbs__name">{slot === 'card' ? `${i === 0 ? 'Front' : 'Back'}: ` : ''}{f.name}</span>
                <span className="ob-thumbs__size">{formatBytes(f.file.size)}</span>
              </span>
              <button type="button" className="ob-remove" aria-label={`Remove ${f.name}`} onClick={() => {
                onRemove(slot, f.id)
                inputRef.current?.focus()
              }}>
                <Cross />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="ob-error" id={`${id}-error`}>
          <Bang />
          {error}
        </p>
      )}
    </div>
  )
}

function Bang() {
  return (
    <svg className="ob-error__icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5v4.2M8 11.2v.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function Cross() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
