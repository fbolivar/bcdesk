import { describe, it, expect } from 'vitest'
import { ruleTriggers, cooldownElapsed, type AlertRule } from './alerts'

const NOW = 1_700_000_000_000

describe('ruleTriggers — métricas cpu/ram/disco', () => {
  const cpuHigh: AlertRule = { metric: 'cpu_pct', operator: '>', threshold: 90, severity: 'high' }

  it('dispara cuando la métrica cruza el umbral', () => {
    expect(ruleTriggers(cpuHigh, { cpu_pct: 95, ram_pct: 10, disk_free_pct: 50 }, NOW, NOW)).toBe(true)
  })
  it('no dispara si está por debajo', () => {
    expect(ruleTriggers(cpuHigh, { cpu_pct: 80, ram_pct: 10, disk_free_pct: 50 }, NOW, NOW)).toBe(false)
  })
  it('disco libre BAJO usa operador <', () => {
    const diskLow: AlertRule = { metric: 'disk_free_pct', operator: '<', threshold: 10, severity: 'critical' }
    expect(ruleTriggers(diskLow, { cpu_pct: 1, ram_pct: 1, disk_free_pct: 5 }, NOW, NOW)).toBe(true)
    expect(ruleTriggers(diskLow, { cpu_pct: 1, ram_pct: 1, disk_free_pct: 20 }, NOW, NOW)).toBe(false)
  })
  it('sin métrica todavía, no se puede evaluar → no dispara', () => {
    expect(ruleTriggers(cpuHigh, null, NOW, NOW)).toBe(false)
    expect(ruleTriggers(cpuHigh, { cpu_pct: null, ram_pct: null, disk_free_pct: null }, NOW, NOW)).toBe(false)
  })
})

describe('ruleTriggers — offline (NO usa métricas, usa last_seen_at)', () => {
  const offline15: AlertRule = { metric: 'offline', operator: '>', threshold: 15, severity: 'high' }

  it('dispara si lleva más minutos que el umbral sin reportar', () => {
    const lastSeen = NOW - 20 * 60000 // hace 20 min
    expect(ruleTriggers(offline15, null, lastSeen, NOW)).toBe(true)
  })
  it('no dispara si reportó hace poco', () => {
    const lastSeen = NOW - 5 * 60000 // hace 5 min
    expect(ruleTriggers(offline15, null, lastSeen, NOW)).toBe(false)
  })
  it('si nunca reportó (last_seen null), se considera offline', () => {
    expect(ruleTriggers(offline15, null, null, NOW)).toBe(true)
  })
})

describe('cooldownElapsed', () => {
  it('primera vez (sin last_triggered) siempre permite', () => {
    expect(cooldownElapsed(null, 60, NOW)).toBe(true)
  })
  it('no permite antes de completar el cooldown', () => {
    expect(cooldownElapsed(NOW - 30 * 60000, 60, NOW)).toBe(false)
  })
  it('permite una vez pasado el cooldown', () => {
    expect(cooldownElapsed(NOW - 61 * 60000, 60, NOW)).toBe(true)
  })
})
