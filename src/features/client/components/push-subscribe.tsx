'use client'

import { Bell, BellOff } from 'lucide-react'
import { usePushNotifications } from '@/features/pwa/hooks/use-push-notifications'

export function PushSubscribe() {
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications()

  if (!supported) return null

  const toggle = subscribed ? unsubscribe : subscribe

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
      style={subscribed ? {
        borderColor: 'rgba(16,185,129,0.3)',
        color: '#10B981',
        background: 'rgba(16,185,129,0.1)',
      } : {
        borderColor: '#E6EBF2',
        color: '#64748B',
      }}
      title={subscribed ? 'Desactivar notificaciones push' : 'Activar notificaciones push'}
    >
      {subscribed ? <Bell size={12} /> : <BellOff size={12} />}
      {subscribed ? 'Notificaciones activas' : 'Activar notificaciones'}
    </button>
  )
}
