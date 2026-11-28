import { useState, type FormEvent } from 'react'
import ChoiceField from '../../components/ui/ChoiceField'
import Dialog from '../../components/ui/Dialog'
import { useCreateHabit } from '../../features/habits/queries'
import { CATEGORIES } from '../../features/habits/stats'
import { DAYS } from '../../features/onboarding/habitPresets'
import styles from './habits.module.css'

export default function CreateHabitDialog({ close }: { close: () => void }) {
  const create = useCreateHabit()
  const [name, setName] = useState('')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [time, setTime] = useState('08:00')
  const [category, setCategory] = useState('mindfulness')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !days.length || create.isPending) return
    create.mutate({ name: name.trim(), weekdays: days, time, category }, { onSuccess: close })
  }

  return (
    <Dialog title="Novo hábito" onClose={close} busy={create.isPending}>
      <form onSubmit={submit} className={styles.habitForm}>
        <label>Nome do hábito<input className={styles.input} required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Ler por 20 minutos" /></label>
        <div className={styles.rowBetween}><strong>Dias ativos</strong><button type="button" className={styles.link} onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>Todos os dias</button></div>
        <div className={styles.days} role="group" aria-label="Dias ativos">
          {DAYS.map(({ v, label, letter }) => <button key={v} type="button" className={days.includes(v) ? styles.dayOn : styles.dayBtn} aria-label={label} aria-pressed={days.includes(v)}
            onClick={() => setDays((current) => current.includes(v) ? current.filter((day) => day !== v) : [...current, v])}>{letter}</button>)}
        </div>
        <label>Horário<input className={styles.input} type="time" value={time} required onChange={(event) => setTime(event.target.value)} /></label>
        <ChoiceField label="Categoria do hábito" value={category} onChange={setCategory} options={CATEGORIES.map(({ id, label }) => ({ value: id, label }))} />
        <button type="submit" className={styles.primary} disabled={!name.trim() || !days.length || create.isPending}>{create.isPending ? 'Salvando…' : 'Criar hábito'}</button>
        {create.isError && <p role="alert" className={styles.error}>Não foi possível criar o hábito. Tente novamente.</p>}
      </form>
    </Dialog>
  )
}
