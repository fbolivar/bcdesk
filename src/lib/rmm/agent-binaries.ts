// Versión del agente publicada en el bucket público rmm-agent de Storage.
// Al subir un binario nuevo (scripts/upload-agent-binaries.mjs), sube esta
// versión y re-sube los archivos con el nuevo nombre.
export const AGENT_VERSION = '0.1.1'

const BUCKET = 'rmm-agent'

/** URL pública del binario del agente para el SO dado. El binario no tiene
 *  secretos (el token va en el config), así que es seguro que sea público. */
export function agentBinaryUrl(os: 'windows' | 'linux'): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
  const file = os === 'windows'
    ? `hexdesk-agent-${AGENT_VERSION}-windows-amd64.exe`
    : `hexdesk-agent-${AGENT_VERSION}-linux-amd64`
  return `${base}/storage/v1/object/public/${BUCKET}/${file}`
}
