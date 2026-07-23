/**
 * Catálogo CERRADO de comandos RMM (fase 1). No hay ejecución de texto libre:
 * el agente solo entiende estos tipos y valida los parámetros. Cualquier
 * command_type fuera de esta lista se rechaza en la API y en el agente.
 *
 * Versionado en el repo a propósito: para cambiar qué puede ejecutarse hay que
 * pasar por un commit revisado, no por la BD.
 */

export type RmmCommandType = 'clean_temp' | 'disk_check' | 'restart_service'

export interface CommandSpec {
  type: RmmCommandType
  label: string
  description: string
  /** Valida el payload; devuelve el payload normalizado o un error legible. */
  validate: (payload: unknown) => { ok: true; payload: Record<string, unknown> } | { ok: false; error: string }
}

const SERVICE_NAME_RE = /^[A-Za-z0-9_.\- ]{1,64}$/

export const COMMAND_CATALOG: Record<RmmCommandType, CommandSpec> = {
  clean_temp: {
    type: 'clean_temp',
    label: 'Limpiar temporales',
    description: 'Borra archivos temporales (%TEMP% en Windows, /tmp en Linux).',
    validate: () => ({ ok: true, payload: {} }),
  },
  disk_check: {
    type: 'disk_check',
    label: 'Chequeo de disco',
    description: 'Chequeo de SOLO LECTURA del disco (chkdsk /scan · smartctl).',
    validate: () => ({ ok: true, payload: {} }),
  },
  restart_service: {
    type: 'restart_service',
    label: 'Reiniciar servicio',
    description: 'Reinicia un servicio del sistema por nombre.',
    validate: (payload: unknown) => {
      const name = (payload as { service_name?: unknown } | null)?.service_name
      if (typeof name !== 'string' || !SERVICE_NAME_RE.test(name.trim())) {
        return { ok: false, error: 'service_name inválido (solo letras, números, espacio, . _ - y máx. 64).' }
      }
      return { ok: true, payload: { service_name: name.trim() } }
    },
  },
}

export function isValidCommandType(t: unknown): t is RmmCommandType {
  return typeof t === 'string' && t in COMMAND_CATALOG
}

/** Valida tipo + payload contra el catálogo. Única puerta de entrada. */
export function validateCommand(
  commandType: unknown,
  payload: unknown,
): { ok: true; type: RmmCommandType; payload: Record<string, unknown> } | { ok: false; error: string } {
  if (!isValidCommandType(commandType)) {
    return { ok: false, error: 'Tipo de comando no permitido.' }
  }
  const res = COMMAND_CATALOG[commandType].validate(payload)
  if (!res.ok) return res
  return { ok: true, type: commandType, payload: res.payload }
}
