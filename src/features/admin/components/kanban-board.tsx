'use client'

import { useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Trash2, X, Calendar } from 'lucide-react'
import { updateTaskStatus, deleteTask, createTask } from '@/features/admin/services/tasks.service'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  assignee_id: string | null
  due_date: string | null
  order_index: number
  profiles?: { full_name: string } | null
}

interface Agent { id: string; full_name: string }

interface Props {
  projectId: string
  initialTasks: Task[]
  agents: Agent[]
}

const COLUMNS = [
  { id: 'todo',        label: 'Por hacer',   color: 'border-[#5B6B7C]' },
  { id: 'in_progress', label: 'En progreso', color: 'border-[#00D4AA]' },
  { id: 'review',      label: 'Revisión',    color: 'border-[#F59E0B]' },
  { id: 'done',        label: 'Completado',  color: 'border-[#10B981]' },
]

function TaskCard({ task, projectId, isDragging = false }: { task: Task; projectId: string; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  async function handleDelete() {
    await deleteTask(task.id, projectId)
  }

  return (
    <div ref={setNodeRef} style={style}
      className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-lg p-3 group hover:border-[#CBD5E1] transition-colors">
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="mt-0.5 text-[#CBD5E1] hover:text-[#5B6B7C] cursor-grab active:cursor-grabbing shrink-0">
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#0B2545] leading-snug">{task.title}</p>
          {task.description && <p className="text-xs text-[#5B6B7C] mt-1 line-clamp-2">{task.description}</p>}
          <div className="flex items-center gap-3 mt-2">
            {task.profiles?.full_name && (
              <span className="text-xs text-[#5B6B7C]">{task.profiles.full_name}</span>
            )}
            {task.due_date && (
              <span className="flex items-center gap-1 text-xs text-[#5B6B7C]">
                <Calendar size={10} /> {task.due_date}
              </span>
            )}
          </div>
        </div>
        <form action={handleDelete}>
          <button type="submit" className="opacity-0 group-hover:opacity-100 text-[#CBD5E1] hover:text-[#EF4444] transition-all">
            <Trash2 size={12} />
          </button>
        </form>
      </div>
    </div>
  )
}

function Column({ col, tasks, projectId, agents }: { col: typeof COLUMNS[0]; tasks: Task[]; projectId: string; agents: Agent[] }) {
  const [adding, setAdding] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div className={`flex-1 min-w-[220px] flex flex-col border-t-2 ${col.color} rounded-t-sm`}>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#5B6B7C]">{col.label}</span>
          <span className="text-xs bg-[#E6EBF2] text-[#5B6B7C] px-1.5 py-0.5 rounded-full">{tasks.length}</span>
        </div>
        {col.id === 'todo' && (
          <button onClick={() => setAdding(true)} className="text-[#CBD5E1] hover:text-[#5B6B7C] transition-colors">
            <Plus size={14} />
          </button>
        )}
      </div>

      <div ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 min-h-[100px] rounded-b-lg transition-colors ${isOver ? 'bg-[#EEF2F7]' : ''}`}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => <TaskCard key={task.id} task={task} projectId={projectId} />)}
        </SortableContext>

        {adding && (
          <form action={async (fd) => { await createTask(projectId, fd); setAdding(false) }}
            className="bg-[#FFFFFF] border border-[#00D4AA] rounded-lg p-3 space-y-2">
            <input name="title" required autoFocus placeholder="Título de la tarea"
              className="w-full bg-transparent text-sm text-[#0B2545] placeholder-[#CBD5E1] focus:outline-none" />
            <textarea name="description" rows={2} placeholder="Descripción (opcional)"
              className="w-full bg-transparent text-xs text-[#5B6B7C] placeholder-[#CBD5E1] focus:outline-none resize-none" />
            <select name="assignee_id"
              className="w-full bg-[#F4F7FB] border border-[#E6EBF2] rounded text-xs text-[#5B6B7C] px-2 py-1 focus:outline-none">
              <option value="">Sin asignar</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
            <input name="due_date" type="date"
              className="w-full bg-[#F4F7FB] border border-[#E6EBF2] rounded text-xs text-[#5B6B7C] px-2 py-1 focus:outline-none" />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-1 rounded bg-[#00D4AA] text-[#0B2545] text-xs font-medium hover:bg-[#00B392] transition-colors">
                Agregar
              </button>
              <button type="button" onClick={() => setAdding(false)} className="text-[#5B6B7C] hover:text-[#5B6B7C]">
                <X size={14} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export function KanbanBoard({ projectId, initialTasks, agents }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function onDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find(t => t.id === e.active.id) ?? null)
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = e
    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string

    // Determine target column: either droping on a column droppable or on another task
    const targetCol = COLUMNS.find(c => c.id === overId)?.id
      ?? tasks.find(t => t.id === overId)?.status

    if (!targetCol) return

    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === targetCol) return

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetCol } : t))
    await updateTaskStatus(taskId, targetCol, projectId)
  }

  const tasksByCol = (colId: string) =>
    tasks.filter(t => t.status === colId).sort((a, b) => a.order_index - b.order_index)

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <Column key={col.id} col={col} tasks={tasksByCol(col.id)} projectId={projectId} agents={agents} />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg p-3 shadow-xl rotate-1 opacity-90">
            <p className="text-sm text-[#0B2545]">{activeTask.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
