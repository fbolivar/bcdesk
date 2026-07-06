import { LoginForm } from '@/features/auth/components/login-form'
import { Logo } from '@/shared/components/logo'

export default function LoginPage() {
  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-8">
      <div className="mb-6">
        <div className="mb-5"><Logo size={34} showTagline /></div>
        <h1 className="text-2xl font-semibold text-[#1E293B]">Bienvenido</h1>
        <p className="text-sm text-[#64748B] mt-1">Ingresa a tu mesa de ayuda</p>
      </div>
      <LoginForm />
    </div>
  )
}
