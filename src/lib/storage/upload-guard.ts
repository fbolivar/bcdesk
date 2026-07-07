/** Validación de archivos subidos: allowlist de MIME + límite de tamaño.
 *  Bloquea tipos ejecutables/renderizables (html, svg) que podrían derivar en
 *  XSS almacenado si el bucket llegara a servirse inline. */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
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
  if (file.size === 0) return 'Archivo vacío.'
  if (file.size > MAX_UPLOAD_BYTES) return 'El archivo supera el límite de 10 MB.'
  if (!ALLOWED_MIME.has(file.type)) return `Tipo de archivo no permitido: ${file.type || 'desconocido'}.`
  return null
}
