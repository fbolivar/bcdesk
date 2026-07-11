import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { GitFork } from 'lucide-react'
import { StatusBadge } from '@/shared/components/priority-badge'
import type { TicketStatus } from '@/lib/supabase/types'

interface SubtaskRow {
  id: string
  title: string
  status: TicketStatus
  assigned_to: string | null
  profiles: { full_name: string } | null
}

interface SubtasksListProps {
  parentId: string
}

const COMPLETED_STATUSES: TicketStatus[] = ['resolved', 'closed']

export async function SubtasksList({ parentId }: SubtasksListProps) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('tickets')
    .select('id, title, status, assigned_to, profiles!assigned_to(full_name)')
    .eq('parent_ticket_id', parentId)
    .order('created_at', { ascending: true })

  const subtasks = (data ?? []) as unknown as SubtaskRow[]

  if (subtasks.length === 0) return null

  const completed = subtasks.filter((s) =>
    COMPLETED_STATUSES.includes(s.status)
  ).length

  const progressPercent = Math.round((completed / subtasks.length) * 100)

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitFork size={14} className="text-[#0E9E86]" />
          <h3 className="text-sm font-semibold text-[#0B2545]">
            Subtareas ({subtasks.length})
          </h3>
        </div>
        <span className="text-xs text-[#5B6B7C]">
          {completed}/{subtasks.length} completadas
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-[#E6EBF2] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#00D4AA] rounded-full transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* List */}
      <ul className="space-y-2">
        {subtasks.map((subtask) => {
          const assigneeName = subtask.profiles?.full_name ?? null
          const isDone = COMPLETED_STATUSES.includes(subtask.status)

          return (
            <li
              key={subtask.id}
              className="flex items-center gap-3 py-1.5 border-b border-[#E6EBF2]/50 last:border-0"
            >
              {/* Status dot */}
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isDone ? 'bg-[#10B981]' : 'bg-[#E6EBF2]'
                }`}
              />

              {/* Title */}
              <Link
                href={`/admin/tickets/${subtask.id}`}
                className={`flex-1 text-sm hover:text-[#0E9E86] transition-colors ${
                  isDone ? 'line-through text-[#5B6B7C]' : 'text-[#0B2545]'
                }`}
              >
                {subtask.title}
              </Link>

              {/* Assignee */}
              {assigneeName && (
                <span className="text-xs text-[#5B6B7C] shrink-0 hidden sm:block">
                  {assigneeName}
                </span>
              )}

              {/* Status badge */}
              <StatusBadge status={subtask.status} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
