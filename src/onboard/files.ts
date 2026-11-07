/*
 * Client-side file checks and processing for the onboarding form.
 * Raster images are resized to at most 1600px on the long side and re-encoded
 * (JPEG ~0.82; PNG kept for logos with transparency). SVG and PDF are sent
 * untouched. The server checks every file again by its bytes.
 */
import { MAX_FILE_BYTES } from './limits'

export type Slot = 'logo' | 'photo' | 'card'
export type Kind = 'png' | 'jpg' | 'webp' | 'svg' | 'pdf'

export type Prepared = {
  id: string
  slot: Slot
  name: string
  file: File
  kind: Kind
  /** Object URL for image thumbnails; null for PDFs. */
  url: string | null
}

export const SLOT_LABEL: Record<Slot, string> = { logo: 'logo', photo: 'profile photo', card: 'business card' }
export const SLOT_KINDS: Record<Slot, Kind[]> = {
  logo: ['png', 'svg', 'jpg', 'webp'],
  photo: ['jpg', 'png', 'webp'],
  card: ['jpg', 'png', 'webp', 'pdf'],
}
export const SLOT_ACCEPT: Record<Slot, string> = {
  logo: 'image/png,image/svg+xml,image/jpeg,image/webp,.png,.svg,.jpg,.jpeg,.webp',
  photo: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
  card: 'image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf',
}
const MAX_LONG_SIDE = 1600
const JPEG_QUALITY = 0.82
/** Raster images larger than this are refused before processing (they'd be slow to decode on a phone). */
const MAX_SOURCE_BYTES = 30 * 1024 * 1024

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const kindList = (slot: Slot) => {
  const names = SLOT_KINDS[slot].map((k) => (k === 'webp' ? 'WebP' : k.toUpperCase()))
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
}

/** The real type from the file's first bytes (not its name). */
async function sniff(file: File): Promise<Kind | null> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  const ascii = (a: number, b: number) => String.fromCharCode(...head.slice(a, b))
  if (head[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png'
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  if (ascii(0, 5) === '%PDF-') return 'pdf'
  const text = new TextDecoder().decode(head).replace(/^﻿/, '')
  if (/^\s*(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[\s\S]*?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return 'svg'
  return null
}

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  // Sample a downscaled copy: fast, and enough to catch a transparent background.
  const s = document.createElement('canvas')
  const sw = Math.max(1, Math.min(96, w))
  const sh = Math.max(1, Math.round((h / w) * sw))
  s.width = sw
  s.height = sh
  const sc = s.getContext('2d')
  if (!sc) return true
  sc.drawImage(ctx.canvas, 0, 0, sw, sh)
  const d = sc.getImageData(0, 0, sw, sh).data
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true
  return false
}

const toBlob = (canvas: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, q),
  )

const baseName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 60) || 'file'

/**
 * Checks and prepares one file for a slot. Throws an Error with a message
 * written for the visitor.
 */
export async function prepare(file: File, slot: Slot): Promise<Prepared> {
  const label = SLOT_LABEL[slot]
  const kind = await sniff(file)
  if (!kind || !SLOT_KINDS[slot].includes(kind))
    throw new Error(`"${file.name}" isn't a supported file for your ${label}. Please use ${kindList(slot)}.`)
  const id = `${slot}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

  if (kind === 'svg' || kind === 'pdf') {
    if (file.size > MAX_FILE_BYTES)
      throw new Error(`"${file.name}" is ${formatBytes(file.size)}. Please use a ${kind.toUpperCase()} under ${formatBytes(MAX_FILE_BYTES)}.`)
    const out = new File([file], `${baseName(file.name)}.${kind}`, { type: kind === 'svg' ? 'image/svg+xml' : 'application/pdf' })
    return { id, slot, name: file.name, file: out, kind, url: kind === 'svg' ? URL.createObjectURL(out) : null }
  }

  if (file.size > MAX_SOURCE_BYTES)
    throw new Error(`"${file.name}" is ${formatBytes(file.size)}, which is too large to process. Please use an image under 30 MB.`)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`We couldn't open "${file.name}". Please try a different ${label} file.`)
  }
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(`We couldn't process "${file.name}". Please try again.`)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  // Logos keep their transparency as PNG; everything else becomes JPEG.
  const keepPng = slot === 'logo' && kind !== 'jpg' && hasTransparency(ctx, w, h)
  let blob: Blob
  if (keepPng) blob = await toBlob(canvas, 'image/png')
  else {
    const flat = document.createElement('canvas')
    flat.width = w
    flat.height = h
    const fc = flat.getContext('2d')!
    fc.fillStyle = '#ffffff'
    fc.fillRect(0, 0, w, h)
    fc.drawImage(canvas, 0, 0)
    blob = await toBlob(flat, 'image/jpeg', JPEG_QUALITY)
  }
  // An already small JPEG that needed no resizing: keep the original if re-encoding made it bigger.
  if (kind === 'jpg' && scale === 1 && file.size <= blob.size) blob = file
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const out = new File([blob], `${baseName(file.name)}.${ext}`, { type: blob.type || 'image/jpeg' })
  if (out.size > MAX_FILE_BYTES)
    throw new Error(`"${file.name}" is still ${formatBytes(out.size)} after resizing. Please use a smaller image.`)
  return { id, slot, name: file.name, file: out, kind: ext === 'png' ? 'png' : 'jpg', url: URL.createObjectURL(out) }
}
