import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/format/currency'
import { redirect, notFound } from 'next/navigation'
import type { Invoice, InvoiceItem } from '@/lib/supabase/types'
import { PrintButton } from './print-button'
import { LogoMark } from '@/shared/components/logo'
import { docTitle, INVOICE_CONTACT_EMAIL } from '@/lib/invoices/doc-type'
import { numberToWordsCOPCapitalized } from '@/lib/invoices/number-to-words'

interface Props { params: Promise<{ id: string }> }

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** 'YYYY-MM-DD' → "09 de julio de 2026" (sin corrimiento de zona). */
function fechaLarga(d: string): string {
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number)
  if (!y || !m || !day) return String(d)
  return `${String(day).padStart(2, '0')} de ${MESES[m - 1]} de ${y}`
}

export default async function InvoicePdfPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const [{ data: invoice }, { data: bp }] = await Promise.all([
    supabase.from('invoices').select('*, organizations(*), invoice_items(*)').eq('id', id).single(),
    supabase.from('billing_profile').select('*').limit(1).maybeSingle(),
  ])
  if (!invoice) notFound()

  const inv = invoice as Invoice & {
    organizations?: { name: string; legal_name?: string | null; tax_id?: string | null; address?: string | null; phone?: string | null }
    invoice_items?: InvoiceItem[]
    doc_type?: string | null
    doc_type_other?: string | null
  }
  const org = inv.organizations
  const items = inv.invoice_items ?? []
  const docLabel = docTitle(inv.doc_type, inv.doc_type_other)
  const isCuentaCobro = (inv.doc_type ?? 'cuenta_cobro') === 'cuenta_cobro'
  const b = bp ?? {}
  const g = (k: string) => (b?.[k] ?? '') as string
  const money = (n: number) => formatMoney(n, inv.currency)
  const declaraciones = (g('declarations') || '').split('\n').map(s => s.trim()).filter(Boolean)

  return (
    <>
      <style>{`
        body { font-family: system-ui, -apple-system, sans-serif; }
        /* Sin márgenes de página: el margen lo pone el propio documento (padding),
           así nunca se corta por conflictos con los márgenes del navegador. */
        @page { size: A4; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-wrap { display: block !important; min-height: 0 !important; padding: 0 !important; background: #fff !important; }
          .doc { width: 100% !important; max-width: none !important; box-shadow: none !important; margin: 0 !important; padding: 12mm 14mm !important; }
          tr, .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <a href={`/admin/invoices/${id}`} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">← Volver</a>
        <PrintButton />
      </div>

      <div className="print-wrap min-h-screen bg-gray-50 print:bg-white flex items-start justify-center py-12 print:py-0 print:block">
        <div className="doc w-[794px] max-w-full bg-white shadow-lg p-12 text-[#1e293b]">

          {/* Encabezado emisor */}
          <div className="flex items-center gap-3 pb-4 border-b-2 border-[#0B2545]">
            <LogoMark size={34} />
            <div>
              <p className="font-bold text-[#0B2545] text-base leading-tight">{g('issuer_name') || 'Fernando Bolívar Buitrago'}</p>
              <p className="text-[10px] tracking-wider text-[#5B6B7C] uppercase">{g('issuer_role') || 'Consultor en Ciberseguridad'}</p>
            </div>
            <div className="ml-auto text-right">
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">{inv.status === 'paid' ? 'Pagada' : inv.status === 'draft' ? 'Borrador' : 'Emitida'}</span>
            </div>
          </div>

          {isCuentaCobro ? (
            <>
              {/* Título */}
              <h1 className="text-2xl font-bold text-[#0B2545] mt-6">CUENTA DE COBRO No. {inv.invoice_number}</h1>
              <p className="text-sm text-[#5B6B7C] mt-1">{g('issuer_city') || 'Bogotá D.C., Colombia'}, {fechaLarga(inv.issue_date)}</p>

              {/* Cliente */}
              <div className="mt-6">
                <p className="font-bold text-[#0B2545] uppercase">{org?.legal_name || org?.name}</p>
                <p className="text-sm text-[#334155] mt-1">NIT / C.C.: {org?.tax_id || '________'}</p>
                <p className="text-sm text-[#334155]">Dirección: {org?.address || '________'}</p>
              </div>

              {/* DEBE A */}
              <div className="text-center my-6 avoid-break">
                <p className="text-sm font-bold tracking-wider text-[#0B2545]">DEBE A</p>
                <p className="font-bold text-[#0B2545] mt-2">{(g('issuer_name') || 'Fernando Bolívar Buitrago').toUpperCase()}</p>
                <p className="text-sm text-[#334155]">C.C. {g('issuer_cc') || '________'}{g('issuer_cc_city') ? ` de ${g('issuer_cc_city')}` : ''}</p>
              </div>

              {/* Concepto */}
              <table className="w-full text-sm border border-[#0B2545]">
                <thead>
                  <tr className="bg-[#0B2545] text-white">
                    <th className="text-left px-3 py-2 font-semibold">Concepto</th>
                    <th className="text-right px-3 py-2 font-semibold w-40">Valor (COP)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} className="border-b border-[#CBD5E1]">
                      <td className="px-3 py-2 text-[#334155]">{it.description}{it.quantity > 1 ? ` (x${it.quantity})` : ''}</td>
                      <td className="px-3 py-2 text-right text-[#0B2545]">{money(it.total_usd)}</td>
                    </tr>
                  ))}
                  {inv.tax_percent > 0 && (
                    <tr className="border-b border-[#CBD5E1]">
                      <td className="px-3 py-2 text-[#334155]">IVA ({inv.tax_percent}%)</td>
                      <td className="px-3 py-2 text-right text-[#0B2545]">{money(inv.tax_usd)}</td>
                    </tr>
                  )}
                  <tr className="font-bold">
                    <td className="px-3 py-2 text-[#0B2545]">VALOR TOTAL</td>
                    <td className="px-3 py-2 text-right text-[#0B2545]">{money(inv.total_usd)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-sm mt-2"><span className="font-bold">Son:</span> {numberToWordsCOPCapitalized(inv.total_usd)}</p>

              {/* Declaraciones */}
              {declaraciones.length > 0 && (
                <div className="mt-6 avoid-break">
                  <p className="font-bold text-[#0B2545] mb-2">Declaraciones</p>
                  <ul className="list-disc pl-5 space-y-1.5 text-[13px] text-[#334155]">
                    {declaraciones.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}

              {/* Datos de pago */}
              <div className="mt-6 avoid-break">
                <p className="font-bold text-[#0B2545] mb-1">Datos para el pago</p>
                <p className="text-sm text-[#334155]">
                  Banco: {g('bank_name') || '________'} &nbsp;·&nbsp; Tipo de cuenta: {g('bank_account_type') || '________'} &nbsp;·&nbsp; No.: {g('bank_account_number') || '________'}
                </p>
                <p className="text-sm text-[#334155]">Titular: {g('bank_holder') || g('issuer_name')} {g('bank_holder_cc') ? `— C.C. ${g('bank_holder_cc')}` : ''}</p>
              </div>

              {inv.notes && <p className="text-sm text-[#5B6B7C] mt-6"><span className="font-medium">Notas:</span> {inv.notes}</p>}
            </>
          ) : (
            <>
              {/* Documento genérico (factura / otro) */}
              <div className="flex items-start justify-between mt-8 mb-8">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Facturado a</p>
                  <p className="font-semibold text-[#0B2545]">{org?.legal_name || org?.name}</p>
                  {org?.tax_id && <p className="text-sm text-gray-500">NIT/C.C.: {org.tax_id}</p>}
                  {org?.address && <p className="text-sm text-gray-500">{org.address}</p>}
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-800">{docLabel.toUpperCase()}</p>
                  <p className="font-mono text-gray-600">{inv.invoice_number}</p>
                  <p className="text-sm text-gray-500 mt-1">Emisión: {fechaLarga(inv.issue_date)}</p>
                  <p className="text-sm text-gray-500">Vence: {fechaLarga(inv.due_date)}</p>
                </div>
              </div>
              <table className="w-full text-sm mb-6">
                <thead><tr className="bg-gray-50 border-y border-gray-200">
                  <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase w-16">Cant.</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase w-28">P. Unit.</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase w-28">Total</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(it => (
                    <tr key={it.id}>
                      <td className="py-2 px-3 text-gray-700">{it.description}</td>
                      <td className="py-2 px-3 text-right text-gray-600">{it.quantity}</td>
                      <td className="py-2 px-3 text-right text-gray-600">{money(it.unit_price_usd)}</td>
                      <td className="py-2 px-3 text-right font-medium text-gray-800">{money(it.total_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <div className="w-56 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{money(inv.subtotal_usd)}</span></div>
                  {inv.tax_percent > 0 && <div className="flex justify-between"><span className="text-gray-500">IVA ({inv.tax_percent}%)</span><span>{money(inv.tax_usd)}</span></div>}
                  <div className="flex justify-between text-base font-bold border-t border-gray-300 pt-2"><span>Total</span><span>{money(inv.total_usd)}</span></div>
                </div>
              </div>
              {inv.notes && <div className="border-t border-gray-200 pt-4 mt-6"><p className="text-xs font-semibold text-gray-400 uppercase mb-1">Notas</p><p className="text-sm text-gray-600">{inv.notes}</p></div>}
            </>
          )}

          {/* Pie */}
          <div className="avoid-break mt-8 pt-4 border-t border-gray-200 text-center text-[11px] text-gray-400">
            {g('issuer_name') || 'Fernando Bolívar Buitrago'} · {g('issuer_email') || INVOICE_CONTACT_EMAIL} · {g('issuer_phone') || '+57 300 406 9787'} · {g('issuer_city') || 'Bogotá D.C., Colombia'}
          </div>
        </div>
      </div>
    </>
  )
}
