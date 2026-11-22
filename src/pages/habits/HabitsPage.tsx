import { useMemo, useState } from 'react'
import { useHabitsData } from '../../features/habits/queries'
import { buildIndex } from '../../features/habits/stats'
import type { View } from './common.tsx'
import MonthlyView from './MonthlyView.tsx'
import WeeklyView from './WeeklyView'
import YearlyView from './YearlyView.tsx'
import styles from './habits.module.css'

export default function HabitsPage() {
  const [view, setView] = useState<View>('monthly')
  const { data, isLoading, error } = useHabitsData()
  const habits = useMemo(() => data?.habits ?? [], [data])
  const ix = useMemo(() => buildIndex(data?.logs ?? []), [data])

  if (isLoading) return <p className={styles.muted}>Loading…</p>
  if (error) return <p className={styles.error}>Could not load your habits.</p>

  const props = { habits, ix, view, setView }
  return (
    <div className={styles.page}>
      {view === 'monthly' && <MonthlyView {...props} />}
      {view === 'weekly' && <WeeklyView {...props} />}
      {view === 'yearly' && <YearlyView {...props} />}
    </div>
  )
}