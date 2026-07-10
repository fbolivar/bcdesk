import type { PDFDocument, PDFImage } from 'pdf-lib'

/** Descarga e incrusta un logo (PNG/JPG) en un documento pdf-lib.
 *  Devuelve null si no hay URL, falla la descarga o el formato no es
 *  soportado (SVG/WEBP no se pueden incrustar) — el llamador cae a texto. */
export async function embedLogo(doc: PDFDocument, url?: string | null): Promise<PDFImage | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (ct.includes('png')) return await doc.embedPng(bytes)
    if (ct.includes('jpeg') || ct.includes('jpg')) return await doc.embedJpg(bytes)
    try { return await doc.embedPng(bytes) } catch { return await doc.embedJpg(bytes) }
  } catch {
    return null
  }
}
