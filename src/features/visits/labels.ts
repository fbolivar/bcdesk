export const VISIT_TYPES = [
  { value: 'support',    label: 'Soporte',            emoji: '🛠️', color: '#00D4AA' },
  { value: 'preventive', label: 'Mant. preventivo',   emoji: '🧰', color: '#10B981' },
  { value: 'corrective', label: 'Mant. correctivo',   emoji: '🔧', color: '#F59E0B' },
  { value: 'incident',   label: 'Incidente',          emoji: '🚨', color: '#EF4444' },
] as const

export const VISIT_STATUS = [
  { value: 'scheduled',   label: 'Programada',  color: '#00D4AA' },
  { value: 'in_progress', label: 'En sitio',    color: '#F59E0B' },
  { value: 'completed',   label: 'Completada',  color: '#10B981' },
  { value: 'cancelled',   label: 'Cancelada',   color: '#94A3B8' },
] as const

export const visitTypeLabel = (v: string) => VISIT_TYPES.find(t => t.value === v)?.label ?? v
export const visitTypeMeta = (v: string) => VISIT_TYPES.find(t => t.value === v)
export const visitStatusLabel = (v: string) => VISIT_STATUS.find(s => s.value === v)?.label ?? v
export const visitStatusColor = (v: string) => VISIT_STATUS.find(s => s.value === v)?.color ?? '#94A3B8'
