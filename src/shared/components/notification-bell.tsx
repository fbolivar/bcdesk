'use client'

import { useEffect, useState, useRef } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/supabase/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const unread = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    async function fetchNotifications() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setNotifications(data)
    }
    fetchNotifications()

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', userId).is('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl transition-all duration-150"
        style={{ color: '#8B9BB4', background: open ? 'rgba(255,255,255,0.06)' : 'transparent' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#F0F4FF' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = open ? 'rgba(255,255,255,0.06)' : 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#8B9BB4' }}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span
            className="absolute top-1 right-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
            style={{ background: '#FF4D6A', boxShadow: '0 0 8px rgba(255,77,106,0.5)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-2xl z-50 overflow-hidden"
          style={{
            background: 'rgba(8,14,26,0.95)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: '#F0F4FF' }}>Notificaciones</span>
              {unread > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(255,77,106,0.15)', color: '#FF4D6A' }}
                >
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs hover:underline transition-colors"
                style={{ color: '#4F8AFF' }}
              >
                Marcar leídas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-10">
                <Bell size={24} className="mx-auto mb-2 opacity-20" style={{ color: '#8B9BB4' }} />
                <p className="text-sm" style={{ color: '#4A5568' }}>Sin notificaciones</p>
              </div>
            ) : (
              notifications.map(n => (
                <Link
                  key={n.id}
                  href={n.link ?? '#'}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: !n.is_read ? 'rgba(79,138,255,0.04)' : 'transparent' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = !n.is_read ? 'rgba(79,138,255,0.04)' : 'transparent')}
                >
                  <div className="flex items-start gap-3">
                    {!n.is_read && (
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: '#4F8AFF', boxShadow: '0 0 6px rgba(79,138,255,0.6)' }} />
                    )}
                    <div className={!n.is_read ? '' : 'pl-[18px]'}>
                      <p className="text-sm font-medium" style={{ color: '#F0F4FF' }}>{n.title}</p>
                      {n.body && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#8B9BB4' }}>{n.body}</p>}
                      <p className="text-[10px] mt-1" style={{ color: '#4A5568' }}>
                        {formatDistanceToNow(new Date(n.created_at), { locale: es, addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
