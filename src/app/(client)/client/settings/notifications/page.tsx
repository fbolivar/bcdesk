import { Bell } from 'lucide-react'
import { NotificationSettings } from '@/features/pwa/components/notification-settings'

export default function ClientNotificationsSettingsPage() {
  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(79,138,255,0.15)' }}
        >
          <Bell size={20} color="#4F8AFF" />
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#F1F5F9' }}>
            Notificaciones push
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
            Recibe alertas en tiempo real en este dispositivo
          </p>
        </div>
      </div>

      {/* Configuración */}
      <NotificationSettings />

      <p className="text-xs text-center mt-5" style={{ color: '#475569' }}>
        Puedes cambiar esta configuración en cualquier momento
      </p>
    </div>
  )
}
