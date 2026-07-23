import { describe, it, expect } from 'vitest'
import { validateCommand, isValidCommandType } from './commands'

describe('catálogo de comandos (cerrado)', () => {
  it('acepta clean_temp y disk_check sin payload', () => {
    expect(validateCommand('clean_temp', undefined).ok).toBe(true)
    expect(validateCommand('disk_check', {}).ok).toBe(true)
  })

  it('rechaza un tipo fuera del catálogo (no ejecución libre)', () => {
    const r = validateCommand('rm -rf /', {})
    expect(r.ok).toBe(false)
    expect(isValidCommandType('rm -rf /')).toBe(false)
    // Un comando de shell arbitrario nunca es un tipo válido:
    expect(validateCommand('exec', { cmd: 'shutdown' }).ok).toBe(false)
  })

  it('restart_service exige un service_name válido', () => {
    expect(validateCommand('restart_service', { service_name: 'Spooler' }).ok).toBe(true)
    expect(validateCommand('restart_service', { service_name: 'nginx.service' }).ok).toBe(true)
  })

  it('restart_service rechaza inyección en service_name', () => {
    expect(validateCommand('restart_service', { service_name: 'svc; rm -rf /' }).ok).toBe(false)
    expect(validateCommand('restart_service', { service_name: '$(whoami)' }).ok).toBe(false)
    expect(validateCommand('restart_service', {}).ok).toBe(false)
    expect(validateCommand('restart_service', { service_name: 'a'.repeat(65) }).ok).toBe(false)
  })

  it('normaliza el service_name (trim)', () => {
    const r = validateCommand('restart_service', { service_name: '  Spooler  ' })
    expect(r.ok && r.payload.service_name).toBe('Spooler')
  })
})
