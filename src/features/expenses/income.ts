/** Cálculo del ingreso NETO real de una cuenta de cobro / factura, para
 *  la rentabilidad.
 *
 *  Si la cuenta tiene `amount_received` (lo que de verdad entró al banco),
 *  ese dato MANDA sobre cualquier estimación: la retención real la decide
 *  cada cliente y no siempre coincide con retention_pct.
 *
 *  Sin `amount_received` se estima según el tipo de documento:
 *   - factura: el IVA no es ingreso (se traslada a la DIAN) → neto = base.
 *   - cuenta de cobro: el cliente descuenta retención en la fuente → neto = base − retención.
 *   - otro: sin ajuste. */

export type InvoiceLike = {
  subtotal_usd?: number | string | null
  tax_usd?: number | string | null
  total_usd?: number | string | null
  doc_type?: string | null
  /** Monto realmente consignado por el cliente. Null = aún no se sabe. */
  amount_received?: number | string | null
}

export type NetIncome = {
  gross: number      // total facturado (lo que ve el cliente)
  iva: number        // IVA excluido del ingreso
  retention: number  // retención descontada
  net: number        // ingreso neto real que te queda
  actual: boolean    // true = calculado con el dinero real recibido; false = estimación
}

export function netIncome(inv: InvoiceLike, retentionPct: number): NetIncome {
  const base = Number(inv.subtotal_usd ?? 0)
  const iva = Number(inv.tax_usd ?? 0)
  const total = Number(inv.total_usd ?? base + iva)
  const dt = inv.doc_type ?? 'cuenta_cobro'

  // ── Dato real: lo que efectivamente se recibió ──
  const raw = inv.amount_received
  if (raw !== null && raw !== undefined && raw !== '') {
    const received = Number(raw)
    if (!Number.isNaN(received)) {
      return {
        gross: total,
        iva,
        // Lo que el cliente descontó = lo facturado − lo consignado.
        retention: Math.max(0, total - received),
        // El IVA recibido no es ingreso propio (se traslada a la DIAN).
        net: received - iva,
        actual: true,
      }
    }
  }

  // ── Estimación (aún no hay pago registrado) ──
  if (dt === 'factura') {
    return { gross: total, iva, retention: 0, net: base, actual: false }
  }
  if (dt === 'cuenta_cobro') {
    const retention = base * (retentionPct / 100)
    return { gross: total, iva, retention, net: base - retention, actual: false }
  }
  return { gross: total, iva: 0, retention: 0, net: total, actual: false }
}

/** Suma de ingresos netos de un conjunto de documentos (no cancelados).
 *  `anyEstimated` avisa si algún documento aún no tiene el pago real registrado. */
export function sumNetIncome(invoices: InvoiceLike[], retentionPct: number) {
  return invoices.reduce(
    (acc, inv) => {
      const n = netIncome(inv, retentionPct)
      acc.gross += n.gross; acc.iva += n.iva; acc.retention += n.retention; acc.net += n.net
      if (!n.actual) acc.anyEstimated = true
      return acc
    },
    { gross: 0, iva: 0, retention: 0, net: 0, anyEstimated: false },
  )
}
