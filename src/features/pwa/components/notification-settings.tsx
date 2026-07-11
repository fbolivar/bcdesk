'use client'

import { Bell, BellOff, BellRing, Smartphone, AlertCircle, CheckCircle2 } from 'lucide-react'
import { usePushNotifications } from '../hooks/use-push-notifications'

const VAPID_CONFIGURED =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY !== undefined &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY !== 'placeholder_replace_with_real_key'

export function NotificationSettings() {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications()

  if (!supported) {
    return (
      <div
        className="rounded-2xl p-5 flex items-start gap-4"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(100,116,139,0.15)' }}
        >
          <BellOff size={18} color="#5B6B7C" />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: '#0B2545' }}>
            Notificaciones no disponibles
          </p>
          <p className="text-xs mt-1" style={{ color: '#5B6B7C' }}>
            Tu navegador no soporta notificaciones push. Prueba con Chrome, Edge o Firefox en escritorio o Android.
          </p>
        </div>
      </div>
    )
  }

  if (!VAPID_CONFIGURED) {
    return (
      <div
        className="rounded-2xl p-5 flex items-start gap-4"
        style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(239,68,68,0.15)' }}
        >
          <AlertCircle size={18} color="#EF4444" />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: '#FCA5A5' }}>
            Configuración pendiente
          </p>
          <p className="text-xs mt-1" style={{ color: '#5B6B7C' }}>
            Las VAPID keys no están configuradas. Contacta al administrador del sistema.
          </p>
        </div>
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div
        className="rounded-2xl p-5 flex items-start gap-4"
        style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(245,158,11,0.15)' }}
        >
          <AlertCircle size={18} color="#F59E0B" />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: '#FCD34D' }}>
            Notificaciones bloqueadas
          </p>
          <p className="text-xs mt-1" style={{ color: '#5B6B7C' }}>
            Bloqueaste las notificaciones en este navegador. Para reactivarlas, ve a los ajustes de tu navegador y permite las notificaciones para este sitio.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-5"
      style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
    >
      {/* Estado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: subscribed
                ? 'rgba(16,185,129,0.15)'
                : 'rgba(0, 212, 170,0.15)',
            }}
          >
            {subscribed
              ? <BellRing size={18} color="#10B981" />
              : <Bell size={18} color="#00D4AA" />
            }
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#0B2545' }}>
              {subscribed ? 'Notificaciones activas' : 'Notificaciones desactivadas'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#5B6B7C' }}>
              {subscribed
                ? 'Recibirás alertas en este dispositivo'
                : 'Actívalas para no perderte nada importante'}
            </p>
          </div>
        </div>

        {subscribed ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} color="#10B981" />
            <span className="text-xs font-medium" style={{ color: '#10B981' }}>Activo</span>
          </div>
        ) : null}
      </div>

      {/* Descripción de notificaciones */}
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#CBD5E1' }}>
          Recibirás notificaciones de:
        </p>
        <ul className="space-y-1.5">
          {[
            'Nuevos tickets creados o asignados',
            'Respuestas y actualizaciones en tus tickets',
            'Cambios de estado en proyectos',
            'Mensajes nuevos en el chat en vivo',
            'Facturas y contratos pendientes',
          ].map(item => (
            <li key={item} className="flex items-center gap-2 text-xs" style={{ color: '#5B6B7C' }}>
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: '#00D4AA' }}
              />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Dispositivo */}
      <div className="flex items-center gap-2 text-xs" style={{ color: '#CBD5E1' }}>
        <Smartphone size={12} />
        <span>Solo aplica a este dispositivo y navegador</span>
      </div>

      {/* Botón */}
      {subscribed ? (
        <button
          onClick={unsubscribe}
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: loading ? '#5B6B7C' : '#F87171',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Desactivando...' : 'Desactivar notificaciones'}
        </button>
      ) : (
        <button
          onClick={subscribe}
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: loading ? 'rgba(0, 212, 170,0.15)' : '#00D4AA',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Activando...' : 'Activar notificaciones'}
        </button>
      )}
    </div>
  )
}
