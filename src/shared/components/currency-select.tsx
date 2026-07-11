import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/format/currency'

/** Selector de moneda reutilizable para formularios (server-safe). */
export function CurrencySelect({
  name = 'currency',
  defaultValue = DEFAULT_CURRENCY,
  className,
}: {
  name?: string
  defaultValue?: string
  className?: string
}) {
  return (
    <select name={name} defaultValue={defaultValue}
      className={className ?? 'w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]'}>
      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
    </select>
  )
}
