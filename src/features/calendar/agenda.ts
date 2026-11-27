import { eventCategory } from '../../../supabase/functions/_shared/planningCategories'
import type { Task } from '../tasks/queries'
import type { CalendarEvent } from './queries'

export type AgendaTask = Pick<Task, 'id' | 'title' | 'notes' | 'due_at' | 'completed_at' | 'remind_minutes_before' | 'category'>

export interface AgendaItem extends CalendarEvent {
  kind: 'event' | 'task' | 'google'
  href: string
  external?: boolean
  completed?: boolean
  origin?: string
  originColor?: string
  exportedFrom?: string
}

export function scheduleItems(tasks: AgendaTask[]): AgendaItem[] {
  const items: AgendaItem[] = []
  for (const task of tasks) {
    if (!task.due_at) continue
    items.push({
      id: `task:${task.id}`,
      kind: 'task',
      href: `/tasks/${task.id}/edit`,
      title: task.title,
      description: task.notes,
      category: eventCategory(task.category),
      starts_at: task.due_at,
      ends_at: null,
      all_day: false,
      alarm_minutes_before: task.remind_minutes_before,
      completed: !!task.completed_at,
    })
  }

  return items
}
