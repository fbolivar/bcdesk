import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Download, Database, ShieldAlert } from 'lucide-react'
import { BackupRestore } from '@/features/admin/components/backup-restore'
import { BACKUP_TABLES } from '@/features/admin/services/backup'

export const dynamic = 'force-dynamic'

export default async function BackupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Database size={20} className="text-[#0E9E86]" />
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">Respaldo y restauración</h1>
          <p className="text-sm text-[#5B6B7C] mt-0.5">Exporta o recupera todos tus datos en formato propio <b>.fbb</b></p>
        </div>
      </div>

      {/* Exportar */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#0B2545]">Descargar respaldo</h2>
        <p className="text-sm text-[#5B6B7C]">
          Genera un archivo <b>.fbb</b> con {BACKUP_TABLES.length} tablas del sistema
          (organizaciones, tickets, contratos, cuentas de cobro, visitas, gastos, contadores y más).
          Guárdalo en un lugar seguro.
        </p>
        <a href="/api/admin/backup/export"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[#0B2545] text-sm font-medium bg-[#00D4AA] hover:bg-[#00B392] transition-colors">
          <Download size={15} /> Descargar respaldo (.fbb)
        </a>
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs">
          <ShieldAlert size={15} className="shrink-0 mt-0.5" />
          <span>El archivo <b>.fbb</b> contiene datos sensibles (incluidas credenciales cifradas). No lo compartas ni lo subas a servicios públicos.</span>
        </div>
      </div>

      {/* Restaurar */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#0B2545]">Restaurar desde respaldo</h2>
        <p className="text-sm text-[#5B6B7C]">
          Carga un archivo <b>.fbb</b> para recuperar los datos. La restauración es <b>aditiva</b>:
          actualiza los registros que coincidan por id y agrega los que falten, pero no elimina nada.
        </p>
        <BackupRestore />
      </div>
    </div>
  )
}
