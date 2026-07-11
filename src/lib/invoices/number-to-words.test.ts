import { describe, it, expect } from 'vitest'
import { numberToWordsCOP, numberToWordsCOPCapitalized } from './number-to-words'

describe('numberToWordsCOP', () => {
  it('cero', () => {
    expect(numberToWordsCOP(0)).toBe('cero pesos m/cte.')
  })

  it('ciento veinte mil', () => {
    expect(numberToWordsCOP(120000)).toBe('ciento veinte mil pesos m/cte.')
  })

  it('un millón (singular, apócope)', () => {
    expect(numberToWordsCOP(1_000_000)).toBe('un millón pesos m/cte.')
  })

  it('un millón setecientos ochenta y cinco mil', () => {
    expect(numberToWordsCOP(1_785_000)).toBe('un millón setecientos ochenta y cinco mil pesos m/cte.')
  })

  it('cien exacto', () => {
    expect(numberToWordsCOP(100)).toBe('cien pesos m/cte.')
  })

  it('redondea decimales', () => {
    expect(numberToWordsCOP(106800.4)).toBe('ciento seis mil ochocientos pesos m/cte.')
  })

  it('miles de millones ya no produce "undefined"', () => {
    const w = numberToWordsCOP(1_200_000_000)
    expect(w).not.toContain('undefined')
    expect(w).toBe('mil doscientos millones pesos m/cte.')
  })

  it('capitaliza la primera letra', () => {
    expect(numberToWordsCOPCapitalized(120000)).toBe('Ciento veinte mil pesos m/cte.')
  })
})
