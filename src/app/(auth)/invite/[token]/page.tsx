import { getInvitationByToken } from '@/features/auth/services/auth.service'
import { RegisterForm } from '@/features/auth/components/register-form'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    notFound()
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0B2545]">Crear tu cuenta</h1>
        <p className="text-sm text-[#5B6B7C] mt-1">Completa tu registro para acceder al portal</p>
      </div>
      <RegisterForm
        token={token}
        email={invitation.email}
        orgName={(invitation as { organizations?: { name: string } }).organizations?.name}
      />
    </div>
  )
}
