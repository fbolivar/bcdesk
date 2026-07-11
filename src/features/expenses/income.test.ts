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
  })
})
