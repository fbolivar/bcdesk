import { LoginForm } from '@/features/auth/components/login-form'

export default function LoginPage() {
  return (
    <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#F1F5F9]">Bienvenido</h1>
        <p className="text-sm text-[#94A3B8] mt-1">Ingresa a tu portal BCDesk</p>
      </div>
      <LoginForm />
    </div>
  )
}
