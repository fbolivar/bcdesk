import type { TicketCategory } from '@/lib/supabase/types'

/**
 * Fuente única de categorías de tickets (valor → etiqueta).
 * Alineadas a ITIL + genéricas. Cambiar aquí se refleja en toda la app.
 * Debe mantenerse en sync con el CHECK de `tickets.category` (migración 013).
 */
export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  // ITIL
  hardware: 'Hardware',
  software: 'Software',
  network: 'Red y Conectividad',
  access: 'Accesos e Identidad',
  email: 'Correo y Comunicaciones',
  security: 'Seguridad',
  application: 'Aplicaciones',
  service_request: 'Solicitud de Servicio',
  // Genéricas
  support: 'Soporte',
  other: 'Otro',
  development: 'Desarrollo',
  billing: 'Facturación',
  onboarding: 'Onboarding',
}

export const TICKET_CATEGORY_VALUES = Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[]

export function categoryLabel(value: string): string {
  return (TICKET_CATEGORY_LABELS as Record<string, string>)[value] ?? value
}
