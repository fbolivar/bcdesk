import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listApprovalWorkflows } from '@/features/admin/services/approval.service'
import { ApprovalWorkflowBuilder } from '@/features/admin/components/approval-workflow-builder'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const [workflows, { data: staff }] = await Promise.all([
    listApprovalWorkflows(),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'agent']).eq('is_active', true).order('full_name'),
  ])

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Workflows de aprobación</h1>
        <p className="text-sm text-[#64748B] mt-0.5">
          Diseña cadenas de aprobación visuales para cambios, solicitudes y compras.
        </p>
      </div>

      <ApprovalWorkflowBuilder workflows={workflows} staff={staff ?? []} />
    </div>
  )
}
