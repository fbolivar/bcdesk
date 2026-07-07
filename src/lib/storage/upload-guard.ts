/** Validación de archivos subidos: allowlist de MIME + límite de tamaño.
 *  Bloquea tipos ejecutables/renderizables (html, svg) que podrían derivar en
 *  XSS almacenado si el bucket llegara a servirse inline. */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
  'image/heic', 'image/heif', 'image/bmp', 'image/tiff', 'image/avif',
  'application/pdf',
  'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
])

/** Devuelve un mensaje de error si el archivo no es válido, o null si pasa. */
export function validateUpload(file: File): string | null {
  return validateUploadMeta(file.size, file.type)
}

/** Igual que validateUpload pero desde metadatos (para uploads sin objeto File,
 *  p.ej. adjuntos de correos entrantes decodificados en el servidor). */
export function validateUploadMeta(size: number, mime: string): string | null {
  if (!size) return 'Archivo vacío.'
  if (size > MAX_UPLOAD_BYTES) return 'El archivo supera el límite de 10 MB.'
  if (!ALLOWED_MIME.has(mime)) return `Tipo de archivo no permitido: ${mime || 'desconocido'}.`
  return null
}
