import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Lock, CheckCircle2, ExternalLink } from 'lucide-react'

export default async function SsoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const providers = [
    {
      id: 'google',
      name: 'Google OAuth',
      description: 'Inicio de sesión con cuentas de Google / Google Workspace',
      color: 'text-[#EA4335]',
      bg: 'bg-[#EA4335]/10',
      docs: 'https://supabase.com/docs/guides/auth/social-login/auth-google',
      steps: [
        'Ir a console.cloud.google.com → APIs & Services → Credentials',
        'Crear OAuth 2.0 Client ID (Web application)',
        'Agregar Redirect URI: https://[project].supabase.co/auth/v1/callback',
        'Copiar Client ID y Client Secret a Supabase → Auth → Providers → Google',
      ],
    },
    {
      id: 'microsoft',
      name: 'Microsoft Azure AD',
      description: 'SSO para organizaciones con Microsoft 365 / Azure AD',
      color: 'text-[#0078D4]',
      bg: 'bg-[#0078D4]/10',
      docs: 'https://supabase.com/docs/guides/auth/social-login/auth-azure',
      steps: [
        'Ir a portal.azure.com → Azure Active Directory → App registrations',
        'Registrar nueva aplicación',
        'Agregar Redirect URI: https://[project].supabase.co/auth/v1/callback',
        'Copiar Application (client) ID y crear Client Secret',
        'Configurar en Supabase → Auth → Providers → Azure',
      ],
    },
    {
      id: 'saml',
      name: 'SAML 2.0',
      description: 'SSO empresarial genérico compatible con Okta, Auth0, OneLogin, ADFS',
      color: 'text-[#8B5CF6]',
      bg: 'bg-[#8B5CF6]/10',
      docs: 'https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml',
      steps: [
        'Activar SAML en Supabase → Auth → SSO Providers',
        'Descargar metadata XML de BCDesk (disponible en Supabase dashboard)',
        'Configurar en tu IdP (Okta/Auth0/OneLogin) con el SP metadata',
        'Ingresar el IDP Metadata URL en Supabase → Auth → SSO Providers',
        'Habilitar el dominio del correo corporativo para redirigir a SSO',
      ],
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Para equipos de desarrollo que usan GitHub Organizations',
      color: 'text-[#F1F5F9]',
      bg: 'bg-[#334155]',
      docs: 'https://supabase.com/docs/guides/auth/social-login/auth-github',
      steps: [
        'Ir a github.com → Settings → Developer Settings → OAuth Apps',
        'Crear nueva OAuth App',
        'Authorization callback URL: https://[project].supabase.co/auth/v1/callback',
        'Copiar Client ID y Client Secret a Supabase → Auth → Providers → GitHub',
      ],
    },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">SSO / Autenticación corporativa</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">Configura inicio de sesión único para tu organización</p>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-xl">
        <Lock size={14} className="text-[#3B82F6] shrink-0 mt-0.5" />
        <p className="text-xs text-[#94A3B8]">
          BCDesk usa <strong className="text-[#F1F5F9]">Supabase Auth</strong> que soporta OAuth social y SAML 2.0.
          La configuración se realiza en el dashboard de Supabase. Sigue los pasos para cada proveedor.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {providers.map(p => (
          <div key={p.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${p.bg} ${p.color}`}>{p.name}</span>
                </div>
                <p className="text-sm text-[#64748B] mt-1">{p.description}</p>
              </div>
              <a href={p.docs} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#3B82F6] hover:underline shrink-0">
                <ExternalLink size={12} /> Docs
              </a>
            </div>
            <ol className="space-y-2">
              {p.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 size={14} className="text-[#334155] shrink-0 mt-0.5" />
                  <span className="text-xs text-[#94A3B8]">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}
