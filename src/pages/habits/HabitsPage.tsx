import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHabitsData } from '../../features/habits/queries'
import { buildIndex, type Habit } from '../../features/habits/stats'
import type { View } from './common.tsx'
import HabitSheet from './HabitSheet'
import MonthlyView from './MonthlyView.tsx'
import WeeklyView from './WeeklyView'
import YearlyView from './YearlyView.tsx'
import styles from './habits.module.css'

export default function HabitsPage() {
  const [view, setView] = useState<View>('monthly')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const { data, isLoading, error } = useHabitsData()
  const habits = useMemo(() => data?.habits ?? [], [data])
  const ix = useMemo(() => buildIndex(data?.logs ?? []), [data])

  if (isLoading) return <p className={styles.muted}>Loading…</p>
  if (error) return <p className={styles.error}>Could not load your habits.</p>

  // ?edit=water (vem do card de água da Home) abre direto a meta de água
  const wantsWater = params.get('edit') === 'water'
  const editing: Habit | undefined = wantsWater
    ? habits.find((h) => h.icon === 'water')
    : habits.find((h) => h.id === editingId)

  function closeSheet() {
    setEditingId(null)
    if (wantsWater) {
      setParams((p) => {
        p.delete('edit')
        return p
      }, { replace: true })
    }
  }

  const props = { habits, ix, view, setView }
  return (
    <div className={styles.page}>
      {view === 'monthly' && <MonthlyView {...props} onEdit={(h) => setEditingId(h.id)} />}
      {view === 'weekly' && <WeeklyView {...props} onEdit={(h) => setEditingId(h.id)} />}
      {view === 'yearly' && <YearlyView {...props} />}
      {editing && <HabitSheet key={editing.id} habit={editing} onClose={closeSheet} />}
    </div>
  )
}
