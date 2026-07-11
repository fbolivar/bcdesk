import type { Locale } from './config'

/** Traducción de las etiquetas de navegación (shell de la app).
 *  Clave = texto en español tal como aparece en el sidebar. */
const EN: Record<string, string> = {
  // Grupos (admin)
  'Principal': 'Main',
  'ITSM': 'ITSM',
  'Activos & CMDB': 'Assets & CMDB',
  'Clientes & Proyectos': 'Clients & Projects',
  'Finanzas': 'Finance',
  'Reportes': 'Reports',
  'Conocimiento': 'Knowledge',
  'Configuración': 'Settings',

  // Principal
  'Dashboard': 'Dashboard',
  'Tickets': 'Tickets',
  'Bandeja unificada': 'Unified Inbox',
  'Chat en vivo': 'Live Chat',

  // ITSM
  'Problemas': 'Problems',
  'Cambios RFC': 'RFC Changes',
  'Incidentes MIM': 'Major Incidents',
  'Event Mgmt': 'Event Mgmt',
  'Releases': 'Releases',
  'Mantenimientos': 'Maintenance',

  // Activos & CMDB
  'CMDB / Activos': 'CMDB / Assets',
  'Mapa CMDB': 'CMDB Map',
  'Dependencias': 'Dependencies',
  'Análisis impacto': 'Impact Analysis',
  'Auto-descubrimiento': 'Auto-discovery',
  'Licencias SW': 'SW Licenses',
  'SW Metering': 'SW Metering',

  // Clientes & Proyectos
  'Clientes (CRM)': 'Clients (CRM)',
  'Visitas técnicas': 'Technical Visits',
  'Proyectos': 'Projects',
  'Contratos': 'Contracts',
  'Proveedores': 'Vendors',
  'Portal Orgs': 'Org Portal',

  // Finanzas
  'Facturas': 'Invoices',
  'Estado de cuenta': 'Account Statement',
  'Rentabilidad': 'Profitability',
  'Compras': 'Purchases',
  'IT Financiero': 'IT Finance',

  // Reportes (la clave 'Reportes' ya está mapeada arriba en Grupos)
  'Exportar': 'Export',
  'Rpt. Prog.': 'Scheduled Rpt.',
  'Timesheet': 'Timesheet',
  'Predictivo': 'Predictive',
  'Audit Log': 'Audit Log',

  // Conocimiento
  'Base de conocimiento': 'Knowledge Base',
  'Anuncios': 'Announcements',
  'Encuestas NPS': 'NPS Surveys',
  'Gamificación': 'Gamification',
  'Status Page': 'Status Page',

  // Configuración
  'Equipo': 'Team',
  'Roles': 'Roles',
  'SLA': 'SLA',
  'SLA Policies': 'SLA Policies',
  'Escalación': 'Escalation',
  'Aprobaciones': 'Approvals',
  'Respuestas': 'Canned Replies',
  'Automatización': 'Automation',
  'Macros': 'Macros',
  'Campos extra': 'Custom Fields',
  'Catálogo': 'Catalog',
  'Widget': 'Widget',
  'Branding': 'Branding',
  'Integraciones': 'Integrations',
  'Estado del sistema': 'System Status',
  'Respaldo y restauración': 'Backup & Restore',
  'GDPR / Retención': 'GDPR / Retention',
  'SSO / OAuth': 'SSO / OAuth',
  'AD / LDAP': 'AD / LDAP',
  'Soporte Remoto': 'Remote Support',
  'Horario Laboral': 'Business Hours',
  'Email Inbound': 'Email Inbound',
  'Routing de Skills': 'Skills Routing',
  'API Docs': 'API Docs',
  'Idioma / Language': 'Language',
  'Mi cuenta': 'My Account',

  // Agente
  'Bandeja': 'Inbox',

  // Cliente
  'Mis Tickets': 'My Tickets',
  'Mis Activos': 'My Assets',
  'Mi Equipo': 'My Team',
  'Ayuda': 'Help',
  'Comunidad': 'Community',
  'Servicios': 'Services',
  'Onboarding': 'Onboarding',
  'Estado': 'Status',
  'Notificaciones': 'Notifications',
  'Mi Perfil': 'My Profile',
  'Notif. push': 'Push Notif.',
  'Idioma': 'Language',

  // Roles / acciones
  'Admin': 'Admin',
  'Agente': 'Agent',
  'Cliente': 'Client',
  'Cerrar sesión': 'Log out',
  'Abrir menú': 'Open menu',
  'Cerrar menú': 'Close menu',
}

/** Traduce una etiqueta de navegación al locale dado.
 *  En español devuelve el texto original; en inglés usa el diccionario. */
export function navLabel(label: string, locale: Locale): string {
  if (locale === 'es') return label
  return EN[label] ?? label
}
