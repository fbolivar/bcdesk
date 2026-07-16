import { describe, it, expect } from 'vitest'
import { netIncome, sumNetIncome } from './income'

describe('netIncome', () => {
  it('cuenta de cobro: descuenta la retención (11%)', () => {
    const r = netIncome({ subtotal_usd: 120000, tax_usd: 0, total_usd: 120000, doc_type: 'cuenta_cobro' }, 11)
    expect(r.retention).toBe(13200)
    expect(r.iva).toBe(0)
    expect(r.net).toBe(106800)
    expect(r.gross).toBe(120000)
  })

  it('cuenta de cobro con 0% de retención: neto = total', () => {
    const r = netIncome({ subtotal_usd: 120000, tax_usd: 0, total_usd: 120000, doc_type: 'cuenta_cobro' }, 0)
    expect(r.net).toBe(120000)
    expect(r.retention).toBe(0)
  })

  it('factura: excluye el IVA (neto = base)', () => {
    const r = netIncome({ subtotal_usd: 100000, tax_usd: 19000, total_usd: 119000, doc_type: 'factura' }, 11)
    expect(r.net).toBe(100000)
    expect(r.iva).toBe(19000)
    expect(r.retention).toBe(0)
    expect(r.gross).toBe(119000)
  })

  it('otro: sin ajuste (neto = total)', () => {
    const r = netIncome({ subtotal_usd: 50000, tax_usd: 0, total_usd: 50000, doc_type: 'otro' }, 11)
    expect(r.net).toBe(50000)
  })

  it('doc_type ausente se trata como cuenta de cobro', () => {
    const r = netIncome({ subtotal_usd: 200000, tax_usd: 0, total_usd: 200000 }, 10)
    expect(r.net).toBe(180000)
  })

  it('acepta valores string (como los devuelve Postgres numeric)', () => {
    const r = netIncome({ subtotal_usd: '120000', tax_usd: '0', total_usd: '120000', doc_type: 'cuenta_cobro' }, 11)
    expect(r.net).toBe(106800)
  })

  it('sumNetIncome agrega correctamente', () => {
    const t = sumNetIncome([
      { subtotal_usd: 120000, tax_usd: 0, total_usd: 120000, doc_type: 'cuenta_cobro' },
      { subtotal_usd: 100000, tax_usd: 19000, total_usd: 119000, doc_type: 'factura' },
    ], 11)
    expect(t.net).toBe(106800 + 100000)
    expect(t.iva).toBe(19000)
    expect(t.retention).toBe(13200)
    expect(t.anyEstimated).toBe(true)
  })

  // El caso real de BIOFIX: se estimaba 11% (106.800) pero retuvieron 4% → entraron 115.200.
  it('el monto recibido manda sobre la estimacion', () => {
    const r = netIncome(
      { subtotal_usd: 120000, tax_usd: 0, total_usd: 120000, doc_type: 'cuenta_cobro', amount_received: 115200 },
      11,
    )
    expect(r.net).toBe(115200)
    expect(r.retention).toBe(4800)
    expect(r.gross).toBe(120000)
    expect(r.actual).toBe(true)
  })

  it('en una factura, el IVA recibido no cuenta como ingreso propio', () => {
    // Base 100.000 + IVA 19.000 = 119.000; el cliente retiene 4.000 → consigna 115.000.
    const r = netIncome(
      { subtotal_usd: 100000, tax_usd: 19000, total_usd: 119000, doc_type: 'factura', amount_received: 115000 },
      11,
    )
    expect(r.net).toBe(96000) // 115.000 recibidos − 19.000 de IVA que van a la DIAN
    expect(r.retention).toBe(4000)
    expect(r.actual).toBe(true)
  })

  it('sin monto recibido sigue estimando', () => {
    const r = netIncome({ subtotal_usd: 120000, tax_usd: 0, total_usd: 120000, doc_type: 'cuenta_cobro' }, 11)
    expect(r.net).toBe(106800)
    expect(r.actual).toBe(false)
  })

  it('un monto recibido de 0 (nunca pagaron) no se confunde con vacio', () => {
    const r = netIncome(
      { subtotal_usd: 120000, tax_usd: 0, total_usd: 120000, doc_type: 'cuenta_cobro', amount_received: 0 },
      11,
    )
    expect(r.net).toBe(0)
    expect(r.actual).toBe(true)
  })
})
