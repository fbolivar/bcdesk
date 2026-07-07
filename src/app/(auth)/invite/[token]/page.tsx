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
    <div className="auth-card">
      <h1>Crear tu cuenta</h1>
      <p className="lead">Completa tu registro para acceder al portal</p>
      <RegisterForm
        token={token}
        email={invitation.email}
        orgName={(invitation as { organizations?: { name: string } }).organizations?.name}
      />
    </div>
  )
}
