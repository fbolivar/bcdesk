/** Cálculo del ingreso NETO real de una cuenta de cobro / factura, para
 *  la rentabilidad. Ajusta automáticamente según el tipo de documento:
 *   - factura: el IVA no es ingreso (se traslada a la DIAN) → neto = base.
 *   - cuenta de cobro: el cliente descuenta retención en la fuente → neto = base − retención.
 *   - otro: sin ajuste. */

export type InvoiceLike = {
  subtotal_usd?: number | string | null
  tax_usd?: number | string | null
  total_usd?: number | string | null
  doc_type?: string | null
}

export type NetIncome = {
  gross: number      // total facturado (lo que ve el cliente)
  iva: number        // IVA excluido del ingreso
  retention: number  // retención descontada
  net: number        // ingreso neto real que te queda
}

export function netIncome(inv: InvoiceLike, retentionPct: number): NetIncome {
  const base = Number(inv.subtotal_usd ?? 0)
  const iva = Number(inv.tax_usd ?? 0)
  const total = Number(inv.total_usd ?? base + iva)
  const dt = inv.doc_type ?? 'cuenta_cobro'

  if (dt === 'factura') {
    return { gross: total, iva, retention: 0, net: base }
  }
  if (dt === 'cuenta_cobro') {
    const retention = base * (retentionPct / 100)
    return { gross: total, iva, retention, net: base - retention }
  }
  return { gross: total, iva: 0, retention: 0, net: total }
}

/** Suma de ingresos netos de un conjunto de documentos (no cancelados). */
export function sumNetIncome(invoices: InvoiceLike[], retentionPct: number) {
  return invoices.reduce(
    (acc, inv) => {
      const n = netIncome(inv, retentionPct)
      acc.gross += n.gross; acc.iva += n.iva; acc.retention += n.retention; acc.net += n.net
      return acc
    },
    { gross: 0, iva: 0, retention: 0, net: 0 },
  )
}
