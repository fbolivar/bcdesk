import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { revalidatePath } from 'next/cache'

interface NotificationItem {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

type GroupKey = 'Hoy' | 'Ayer' | 'Esta semana' | string

function getGroupKey(dateStr: string): GroupKey {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (itemDay.getTime() === today.getTime()) return 'Hoy'
  if (itemDay.getTime() === yesterday.getTime()) return 'Ayer'
  if (itemDay >= weekAgo) return 'Esta semana'
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function groupNotifications(list: NotificationItem[]) {
  const groups: Record<GroupKey, NotificationItem[]> = {}
  const order: GroupKey[] = []
  for (const n of list) {
    const key = getGroupKey(n.created_at)
    if (!groups[key]) {
      groups[key] = []
      order.push(key)
    }
    groups[key].push(n)
  }
  return { groups, order }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'justo ahora'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  return `hace ${days} día${days !== 1 ? 's' : ''}`
}

async function markAllRead(userId: string) {
  'use server'
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId)
  revalidatePath('/client/notifications')
}

export default async function ClientNotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const list: NotificationItem[] = notifications ?? []
  const unreadCount = list.filter(n => !n.is_read).length
  const { groups, order } = groupNotifications(list)

  const markAll = markAllRead.bind(null, user.id)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#F0F4FF]">Notificaciones</h1>
          <p className="text-sm text-[#8B9BB4] mt-0.5">
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
          </p>
        </div>

        {unreadCount > 0 && (
          <form action={markAll}>
            <button
              type="submit"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[#4F8AFF] hover:text-[#F0F4FF] transition-colors"
              style={{ background: 'rgba(79,138,255,0.1)', border: '1px solid rgba(79,138,255,0.2)' }}
            >
              <CheckCheck size={14} />
              Marcar todas como leídas
            </button>
          </form>
        )}
      </div>

      {list.length === 0 ? (
        <div
          className="rounded-2xl p-16 flex flex-col items-center justify-center text-center"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Bell size={44} className="text-[#8B9BB4] mb-4" />
          <p className="text-[#F0F4FF] font-medium">No tienes notificaciones</p>
          <p className="text-sm text-[#8B9BB4] mt-1">Aquí aparecerán las actualizaciones de tus tickets y proyectos</p>
        </div>
      ) : (
        <div className="space-y-6">
          {order.map(groupKey => (
            <div key={groupKey}>
              <h2 className="text-xs font-semibold text-[#8B9BB4] uppercase tracking-wider mb-3">{groupKey}</h2>
              <div className="space-y-2">
                {groups[groupKey].map(notification => (
                  <div
                    key={notification.id}
                    className="rounded-2xl p-4 flex items-start gap-3 transition-all"
                    style={{
                      background: notification.is_read
                        ? 'rgba(255,255,255,0.015)'
                        : 'rgba(79,138,255,0.06)',
                      border: notification.is_read
                        ? '1px solid rgba(255,255,255,0.05)'
                        : '1px solid rgba(79,138,255,0.2)',
                    }}
                  >
                    <div className="mt-1 shrink-0">
                      {!notification.is_read ? (
                        <span
                          className="block w-2 h-2 rounded-full"
                          style={{ background: '#4F8AFF' }}
                        />
                      ) : (
                        <span className="block w-2 h-2" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${notification.is_read ? 'text-[#8B9BB4]' : 'text-[#F0F4FF]'}`}>
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="text-xs text-[#8B9BB4] mt-0.5 leading-relaxed">{notification.body}</p>
                      )}
                    </div>

                    <span className="text-xs text-[#8B9BB4] shrink-0">{relativeTime(notification.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
