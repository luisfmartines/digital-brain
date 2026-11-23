import { useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { useCreateExercise, useExercises, type Exercise } from '../../features/workouts/queries'
import { MUSCLES, muscleLabel } from '../../features/workouts/utils'
import styles from './workouts.module.css'

export default function ExercisePicker({ onPick, onClose }: { onPick: (e: Exercise) => void; onClose: () => void }) {
  const { data: all = [] } = useExercises()
  const create = useCreateExercise()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [newMuscle, setNewMuscle] = useState('chest')

  const list = all.filter((e) => (!muscle || e.muscle_group === muscle) && e.name.toLowerCase().includes(q.trim().toLowerCase()))

  function createOne() {
    if (!name.trim()) return
    create.mutate({ name: name.trim(), muscle_group: newMuscle }, { onSuccess: (e) => onPick(e) })
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHead}>
          <strong>Adicionar exercício</strong>
          <button type="button" className={styles.plainBtn} onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <label className={styles.search}><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar exercícios" /></label>
        <div className={styles.filterChips}>
          <button type="button" className={muscle === '' ? styles.fOn : styles.f} onClick={() => setMuscle('')}>Todos</button>
          {Object.entries(MUSCLES).map(([id, label]) => (
            <button key={id} type="button" className={muscle === id ? styles.fOn : styles.f} onClick={() => setMuscle(id)}>{label}</button>
          ))}
        </div>
        <ul className={styles.pickList}>
          {list.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onPick(e)}>
                <strong>{e.name}</strong><small>{muscleLabel(e.muscle_group)}{e.equipment ? ` • ${e.equipment}` : ''}</small>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className={styles.empty}>Nenhum exercício encontrado.</li>}
        </ul>
        {creating ? (
          <div className={styles.createBox}>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do exercício" />
            <select className={styles.input} value={newMuscle} onChange={(e) => setNewMuscle(e.target.value)}>
              {Object.entries(MUSCLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <button type="button" className={styles.primary} onClick={createOne} disabled={!name.trim() || create.isPending}>Criar e adicionar</button>
          </div>
        ) : (
          <button type="button" className={styles.addExBtn} onClick={() => setCreating(true)}><Plus size={14} /> Criar exercício personalizado</button>
        )}
      </div>
    </div>
  )
}