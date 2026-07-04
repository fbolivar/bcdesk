'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Ticket, Briefcase, FileText, ClipboardList,
  Users, Building2, BarChart2, Settings, Inbox, Clock, MessageSquare, Zap, BookOpen, Code2,
  Server, AlertTriangle, GitPullRequest, Megaphone, FileSignature, Download, Grid3X3,
  ArrowUpCircle, ClipboardCheck, Package, Key, Network, Palette, Link2, Star, Shield,
  Trophy, Siren, Lock, Wrench, Building, DollarSign, Activity, ScrollText, Monitor,
  UserCog, MapPin, ChevronDown, ChevronRight, LogOut, Bell, UserCircle, Mail, Cpu, Globe,
  ShoppingCart, Radar,
} from 'lucide-react'
import { logout } from '@/features/auth/services/auth.service'

interface SidebarProps {
  role: 'admin' | 'agent' | 'client'
  userName: string
  orgName?: string
}

type NavItem = { href: string; label: string; icon: React.ElementType }
type NavGroup = { label: string; icon: React.ElementType; items: NavItem[] }

const ADMIN_GROUPS: NavGroup[] = [
  {
    label: 'Principal',
    icon: LayoutDashboard,
    items: [
      { href: '/admin/dashboard',  label: 'Dashboard',        icon: LayoutDashboard },
      { href: '/admin/tickets',    label: 'Tickets',          icon: Ticket },
      { href: '/admin/inbox',      label: 'Bandeja unificada', icon: Inbox },
      { href: '/admin/chat',       label: 'Chat en vivo',     icon: MessageSquare },
    ],
  },
  {
    label: 'ITSM',
    icon: Server,
    items: [
      { href: '/admin/problems',        label: 'Problemas',      icon: AlertTriangle },
      { href: '/admin/changes',         label: 'Cambios RFC',    icon: GitPullRequest },
      { href: '/admin/major-incidents', label: 'Incidentes MIM', icon: Siren },
      { href: '/admin/settings/events', label: 'Event Mgmt',      icon: Activity },
      { href: '/admin/releases',        label: 'Releases',       icon: Package },
      { href: '/admin/maintenance',     label: 'Mantenimientos', icon: Wrench },
    ],
  },
  {
    label: 'Activos & CMDB',
    icon: Server,
    items: [
      { href: '/admin/assets',              label: 'CMDB / Activos',  icon: Server },
      { href: '/admin/assets/map',          label: 'Mapa CMDB',       icon: MapPin },
      { href: '/admin/assets/dependencies', label: 'Dependencias',    icon: Network },
      { href: '/admin/assets/impact',       label: 'Análisis impacto', icon: Zap },
      { href: '/admin/settings/discovery',  label: 'Auto-descubrimiento', icon: Radar },
      { href: '/admin/licenses',            label: 'Licencias SW',    icon: Key },
      { href: '/admin/licenses/metering',   label: 'SW Metering',     icon: Activity },
    ],
  },
  {
    label: 'Clientes & Proyectos',
    icon: Building2,
    items: [
      { href: '/admin/clients',    label: 'Clientes (CRM)', icon: Building2 },
      { href: '/admin/projects',   label: 'Proyectos',    icon: Briefcase },
      { href: '/admin/contracts',  label: 'Contratos',    icon: FileSignature },
      { href: '/admin/vendors',    label: 'Proveedores',  icon: Building },
      { href: '/admin/org-portal', label: 'Portal Orgs',  icon: Building2 },
    ],
  },
  {
    label: 'Finanzas',
    icon: DollarSign,
    items: [
      { href: '/admin/invoices',  label: 'Facturas',      icon: FileText },
      { href: '/admin/purchases', label: 'Compras',       icon: ShoppingCart },
      { href: '/admin/finance',   label: 'IT Financiero', icon: DollarSign },
    ],
  },
  {
    label: 'Reportes',
    icon: BarChart2,
    items: [
      { href: '/admin/reports',            label: 'Reportes',     icon: BarChart2 },
      { href: '/admin/reports/export',     label: 'Exportar',     icon: Download },
      { href: '/admin/reports/scheduled',  label: 'Rpt. Prog.',   icon: ClipboardCheck },
      { href: '/admin/reports/timesheet',  label: 'Timesheet',    icon: Clock },
      { href: '/admin/reports/predictive', label: 'Predictivo',   icon: BarChart2 },
      { href: '/admin/audit-log',          label: 'Audit Log',    icon: ScrollText },
    ],
  },
  {
    label: 'Conocimiento',
    icon: BookOpen,
    items: [
      { href: '/admin/knowledge',      label: 'Base de conocimiento', icon: BookOpen },
      { href: '/admin/announcements',  label: 'Anuncios',             icon: Megaphone },
      { href: '/admin/surveys',        label: 'Encuestas NPS',        icon: Star },
      { href: '/admin/gamification',   label: 'Gamificación',         icon: Trophy },
      { href: '/status',               label: 'Status Page',          icon: Activity },
    ],
  },
  {
    label: 'Configuración',
    icon: Settings,
    items: [
      { href: '/admin/settings/team',           label: 'Equipo',         icon: Users },
      { href: '/admin/settings/roles',          label: 'Roles',          icon: UserCog },
      { href: '/admin/settings/sla',            label: 'SLA',            icon: Clock },
      { href: '/admin/settings/sla-policies',   label: 'SLA Policies',   icon: Clock },
      { href: '/admin/settings/escalation',     label: 'Escalación',     icon: ArrowUpCircle },
      { href: '/admin/settings/approvals',      label: 'Aprobaciones',   icon: GitPullRequest },
      { href: '/admin/settings/canned',         label: 'Respuestas',     icon: MessageSquare },
      { href: '/admin/settings/automation',     label: 'Automatización', icon: Zap },
      { href: '/admin/settings/macros',         label: 'Macros',         icon: Zap },
      { href: '/admin/settings/fields',         label: 'Campos extra',   icon: Settings },
      { href: '/admin/settings/catalog',        label: 'Catálogo',       icon: Grid3X3 },
      { href: '/admin/settings/widget',         label: 'Widget',         icon: Code2 },
      { href: '/admin/settings/branding',       label: 'Branding',       icon: Palette },
      { href: '/admin/settings/integrations',   label: 'Integraciones',  icon: Link2 },
      { href: '/admin/settings/gdpr',           label: 'GDPR / Retención', icon: Shield },
      { href: '/admin/settings/sso',            label: 'SSO / OAuth',    icon: Lock },
      { href: '/admin/settings/directory',      label: 'AD / LDAP',      icon: Network },
      { href: '/admin/settings/remote-support', label: 'Soporte Remoto', icon: Monitor },
      { href: '/admin/settings/business-hours', label: 'Horario Laboral', icon: Clock },
      { href: '/admin/settings/email-inbound', label: 'Email Inbound', icon: Mail },
      { href: '/admin/settings/skills-routing', label: 'Routing de Skills', icon: Cpu },
      { href: '/api-docs', label: 'API Docs', icon: Code2 },
      { href: '/admin/settings/language', label: 'Idioma / Language', icon: Globe },
      { href: '/admin/account', label: 'Mi cuenta', icon: UserCircle },
    ],
  },
]

const AGENT_ITEMS: NavItem[] = [
  { href: '/agent/dashboard', label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/agent/tickets',   label: 'Bandeja',     icon: Inbox },
  { href: '/agent/chat',      label: 'Chat en vivo', icon: MessageSquare },
  { href: '/agent/account',   label: 'Mi cuenta',    icon: UserCircle },
]

const CLIENT_ITEMS: NavItem[] = [
  { href: '/client/dashboard',      label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/client/tickets',        label: 'Mis Tickets',      icon: Ticket },
  { href: '/client/chat',           label: 'Chat en vivo',     icon: MessageSquare },
  { href: '/client/projects',       label: 'Proyectos',        icon: Briefcase },
  { href: '/client/invoices',       label: 'Facturas',         icon: FileText },
  { href: '/client/contracts',      label: 'Contratos',        icon: FileSignature },
  { href: '/client/assets',         label: 'Mis Activos',      icon: Server },
  { href: '/client/team',           label: 'Mi Equipo',        icon: Users },
  { href: '/client/knowledge',      label: 'Ayuda',            icon: BookOpen },
  { href: '/client/forum',          label: 'Comunidad',        icon: MessageSquare },
  { href: '/client/catalog',        label: 'Servicios',        icon: Grid3X3 },
  { href: '/client/onboarding',     label: 'Onboarding',       icon: ClipboardList },
  { href: '/client/status',         label: 'Estado',           icon: Megaphone },
  { href: '/client/notifications',  label: 'Notificaciones',   icon: Bell },
  { href: '/client/profile',        label: 'Mi Perfil',        icon: UserCircle },
  { href: '/client/settings/notifications', label: 'Notif. push', icon: Bell },
  { href: '/client/settings/language', label: 'Idioma',        icon: Globe },
]

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 relative group"
      style={isActive ? {
        background: 'rgba(79,138,255,0.1)',
        color: '#4F8AFF',
        boxShadow: 'inset 2px 0 0 #4F8AFF',
      } : {
        color: '#64748B',
      }}
    >
      <span
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: '#F4F7FB' }}
      />
      <Icon size={14} className="shrink-0 relative z-10" />
      <span className="flex-1 truncate relative z-10">{item.label}</span>
    </Link>
  )
}

function GroupSection({ group, pathname, defaultOpen = false }: { group: NavGroup; pathname: string; defaultOpen?: boolean }) {
  const hasActive = group.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
  const [open, setOpen] = useState(defaultOpen || hasActive)
  const GroupIcon = group.icon

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors"
        style={{ color: hasActive ? '#4F8AFF' : '#94A3B8', letterSpacing: '0.07em' }}
      >
        <GroupIcon size={11} className="shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        {open
          ? <ChevronDown size={11} />
          : <ChevronRight size={11} />
        }
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 pl-1">
          {group.items.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return <NavLink key={item.href} item={item} isActive={isActive} />
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar({ role, userName, orgName }: SidebarProps) {
  const pathname = usePathname()

  const roleLabel = role === 'admin' ? 'Admin' : role === 'agent' ? 'Agente' : 'Cliente'
  const roleGradient = role === 'admin'
    ? 'linear-gradient(135deg, #4F8AFF, #8B6FFF)'
    : role === 'agent'
    ? 'linear-gradient(135deg, #00D4FF, #4F8AFF)'
    : 'linear-gradient(135deg, #10D98A, #00D4FF)'

  return (
    <aside
      className="w-56 flex flex-col shrink-0"
      style={{
        background: '#FFFFFF',
        borderRight: '1px solid #E6EBF2',
      }}
    >
      {/* Logo */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid #E6EBF2' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{ background: 'linear-gradient(135deg, #4F8AFF 0%, #8B6FFF 100%)', boxShadow: '0 0 14px rgba(79,138,255,0.4)' }}
          >
            BC
          </div>
          <span className="text-base font-semibold tracking-tight" style={{ color: '#0F172A' }}>
            BC<span className="text-gradient">Desk</span>
          </span>
        </div>
        {orgName && <p className="text-[11px] mt-1 truncate" style={{ color: '#94A3B8' }}>{orgName}</p>}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {role === 'admin' ? (
          ADMIN_GROUPS.map((group, i) => (
            <GroupSection
              key={group.label}
              group={group}
              pathname={pathname}
              defaultOpen={i === 0}
            />
          ))
        ) : (
          <div className="space-y-0.5">
            {(role === 'agent' ? AGENT_ITEMS : CLIENT_ITEMS).map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return <NavLink key={item.href} item={item} isActive={isActive} />
            })}
          </div>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid #E6EBF2' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-semibold shrink-0"
            style={{ background: roleGradient }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: '#0F172A' }}>{userName}</p>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                background: role === 'admin' ? 'rgba(79,138,255,0.15)' : role === 'agent' ? 'rgba(0,212,255,0.15)' : 'rgba(16,217,138,0.15)',
                color: role === 'admin' ? '#4F8AFF' : role === 'agent' ? '#00D4FF' : '#10D98A',
              }}
            >
              {roleLabel}
            </span>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#94A3B8' }}
            title="Cerrar sesión"
            onMouseEnter={e => (e.currentTarget.style.color = '#FF4D6A')}
            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
