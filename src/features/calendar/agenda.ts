import { addDays, localDateStr } from '../../lib/date'
import { buildIndex, isDone, isScheduled, type Log, type ScheduledHabit } from '../habits/stats'
import type { Task } from '../tasks/queries'
import type { CalendarEvent } from './queries'

export type AgendaTask = Pick<Task, 'id' | 'title' | 'notes' | 'due_at' | 'completed_at' | 'remind_minutes_before' | 'category'>
export type AgendaHabit = ScheduledHabit & {
  id: string
  name: string
  category: string
  reminder_time: string | null
}

export interface AgendaItem extends CalendarEvent {
  kind: 'event' | 'task' | 'habit'
  href: string
  completed?: boolean
}

export function scheduleItems(tasks: AgendaTask[], habits: AgendaHabit[], logs: Log[], from: Date, until: Date): AgendaItem[] {
  const items: AgendaItem[] = []
  for (const task of tasks) {
    if (!task.due_at) continue
    items.push({
      id: `task:${task.id}`,
      kind: 'task',
      href: `/tasks/${task.id}/edit`,
      title: task.title,
      description: task.notes,
      category: task.category === 'work' ? 'work' : task.category === 'fitness' ? 'health' : 'personal',
      starts_at: task.due_at,
      ends_at: null,
      all_day: false,
      alarm_minutes_before: task.remind_minutes_before,
      completed: !!task.completed_at,
    })
  }

  const done = buildIndex(logs)
  for (let day = from; day < until; day = addDays(day, 1)) {
    const date = localDateStr(day)
    for (const habit of habits) {
      if (!isScheduled(habit, day)) continue
      const clock = habit.reminder_time?.slice(0, 5) ?? ''
      const timed = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock)
      items.push({
        id: `habit:${habit.id}:${date}`,
        kind: 'habit',
        href: `/routine?tab=habits&edit=${encodeURIComponent(habit.id)}`,
        title: habit.name,
        description: null,
        category: ['fitness', 'health'].includes(habit.category) ? 'health' : 'personal',
        starts_at: (timed ? new Date(`${date}T${clock}:00`) : day).toISOString(),
        ends_at: null,
        all_day: !timed,
        alarm_minutes_before: null,
        completed: isDone(done, habit.id, date),
      })
    }
  }
  return items
}
