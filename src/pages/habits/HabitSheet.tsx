import { useConfirmation } from '../../components/ui/useConfirmation'
import ChoiceField from '../../components/ui/ChoiceField'
import { useState } from 'react'
import { Clock, Droplet, Minus, Plus, Trash2, X } from 'lucide-react'
import { CATEGORIES, type Habit } from '../../features/habits/stats'
import { useDeleteHabit, useUpdateHabit } from '../../features/habits/queries'
import { DAYS } from '../../features/onboarding/habitPresets'
import {
  WATER_MAX, WATER_MIN, WATER_STEP, litersLabel, useSetWaterGoal, useWater, waterHabitName,
} from '../../features/water/queries'
import styles from './habits.module.css'

interface Props {
  habit: Habit
  onClose: () => void
}

export default function HabitSheet({ habit, onClose }: Props) {
  const isWater = habit.icon === 'water'
  const update = useUpdateHabit()
  const remove = useDeleteHabit()
  const setGoal = useSetWaterGoal()
  const water = useWater().data

  const [name, setName] = useState(habit.name)
  const [days, setDays] = useState<number[]>(habit.weekdays)
  const [time, setTime] = useState(habit.reminder_time?.slice(0, 5) ?? '08:00')
  const [category, setCategory] = useState(habit.category)
  const [goal, setGoalLocal] = useState<number | null>(null)
  const confirmation = useConfirmation()
  const [error, setError] = useState('')

  const goalMl = goal ?? water?.goal ?? 2500
  const busy = update.isPending || remove.isPending || setGoal.isPending

  function toggleDay(v: number) {
    setDays((cur) => {
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
      return next.length ? next : cur
    })
  }

  async function save() {
    setError('')
    try {
      if (isWater) {
        // Nome e dias do hábito de água são fixos; só a meta e o horário mudam
        if (goal !== null) await setGoal.mutateAsync(goal)
        await update.mutateAsync({ id: habit.id, name: waterHabitName(goalMl), weekdays: habit.weekdays, time, category: habit.category })
      } else {
        if (!name.trim()) return
        await update.mutateAsync({ id: habit.id, name: name.trim(), weekdays: days, time, category })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar')
    }
  }

  async function destroy() {
    setError('')
    try {
      await remove.mutateAsync(habit.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível excluir')
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Editar hábito" onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHead}>
          <strong>{isWater ? 'Meta de água' : 'Editar hábito'}</strong>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        {isWater ? (
          <>
            <p className={styles.sheetNote}>
              <Droplet size={14} /> Vinculado ao cartão de água na tela inicial. O hábito é concluído automaticamente ao atingir a meta.
            </p>
            <span className={styles.cap}>META DIÁRIA</span>
            <div className={styles.stepper}>
              <button type="button" onClick={() => setGoalLocal(Math.max(WATER_MIN, goalMl - WATER_STEP))} disabled={goalMl <= WATER_MIN} aria-label="Diminuir água"><Minus size={18} /></button>
              <div><strong>{litersLabel(goalMl)}</strong><small>{goalMl} ml / dia</small></div>
              <button type="button" onClick={() => setGoalLocal(Math.min(WATER_MAX, goalMl + WATER_STEP))} disabled={goalMl >= WATER_MAX} aria-label="Aumentar água"><Plus size={18} /></button>
            </div>
          </>
        ) : (
          <>
            <span className={styles.cap}>AÇÃO DO HÁBITO</span>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do hábito" />
            <div className={styles.rowBetween}>
              <span className={styles.cap}>DIAS ATIVOS</span>
              <button type="button" className={styles.link} onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>Todos os dias</button>
            </div>
            <div className={styles.days}>
              {DAYS.map((d) => (
                <button key={d.v} type="button" className={days.includes(d.v) ? styles.dayOn : styles.dayBtn} onClick={() => toggleDay(d.v)} aria-pressed={days.includes(d.v)} aria-label={d.label}>
                  {d.letter}
                </button>
              ))}
            </div>
          </>
        )}

        <div className={isWater ? undefined : styles.twoCols}>
          <label className={styles.field}><Clock size={14} /><input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} /></label>
          {!isWater && (
            <ChoiceField label="Categoria do hábito" value={category} onChange={setCategory}
              options={CATEGORIES.map(({ id, label }) => ({ value: id, label }))} />
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="button" className={styles.primary} onClick={save} disabled={busy || (!isWater && !name.trim())}>Salvar alterações</button>

        {!isWater && <button type="button" className={styles.dangerLink} disabled={busy}
          onClick={() => confirmation.ask({ title: 'Excluir hábito?', confirmLabel: 'Excluir hábito', danger: true, onConfirm: destroy })}>
          <Trash2 size={14} /> Excluir hábito
        </button>}
        {confirmation.dialog}
      </div>
    </div>
  )
}
