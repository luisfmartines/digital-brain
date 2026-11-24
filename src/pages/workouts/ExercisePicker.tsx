import { useEffect, useState } from 'react'
import { Info, Plus, Search, X } from 'lucide-react'
import { useCreateExercise, useExercises, type Exercise } from '../../features/workouts/queries'
import { MUSCLES, muscleLabel } from '../../features/workouts/utils'
import ExerciseDetail from './ExerciseDetail'
import styles from './workouts.module.css'
import { useExerciseCatalog, useImportExercise } from '../../features/exercisedb/queries'
import { muscleName } from '../../features/exercisedb/api'
import ExerciseImage, { SavedExerciseImage } from './ExerciseImage'

export default function ExercisePicker({ onPick, onClose }: { onPick: (e: Exercise) => void; onClose: () => void }) {
  const saved = useExercises()
  const all = saved.data ?? []
  const create = useCreateExercise()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [creating, setCreating] = useState(false)
  const [info, setInfo] = useState<Exercise | null>(null)
  const [name, setName] = useState('')
  const [newMuscle, setNewMuscle] = useState('chest')
  const [term, setTerm] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(q), 300)
    return () => window.clearTimeout(timer)
  }, [q])
  const catalog = useExerciseCatalog(term, muscle)
  const importExercise = useImportExercise()
  const remote = catalog.data?.pages.flatMap((page) => page.exercises) ?? []
  const busy = importExercise.isPending || create.isPending

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
            <li key={e.id} className={styles.pickRow}>
              <button type="button" className={styles.catalogExercise} disabled={busy} onClick={() => onPick(e)}>
                <SavedExerciseImage exerciseId={e.id} name={e.name} />
                <span><strong>{e.name}</strong><small>{muscleLabel(e.muscle_group)}{e.equipment ? ` • ${e.equipment}` : ''}</small></span>
              </button>
              <button type="button" className={styles.pickInfo} onClick={() => setInfo(e)} aria-label={`Ver detalhes de ${e.name}`}><Info size={18} /></button>
            </li>
          ))}
          {saved.isError && <li className={styles.empty}>Não foi possível carregar os exercícios salvos. <button type="button" onClick={() => saved.refetch()}>Tentar novamente</button></li>}
          <li className={styles.catalogHeading}>Catálogo ExerciseDB</li>
          {catalog.isPending && <li className={styles.empty}>Carregando exercícios…</li>}
          {remote.map((exercise) => (
            <li key={exercise.id} className={styles.pickRow}>
              <button type="button" className={styles.catalogExercise} disabled={busy} onClick={() => importExercise.mutate(exercise, { onSuccess: onPick })}>
                <ExerciseImage key={exercise.id} src={exercise.imageUrl} externalId={exercise.id} name={exercise.name} />
                <span><strong>{exercise.name}</strong><small>{exercise.targets.map(muscleName).join(', ')}{exercise.equipments.length > 0 && ` • ${exercise.equipments.join(', ')}`}</small></span>
                <Plus size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
          {catalog.isError && <li className={styles.empty}>Não foi possível carregar o catálogo. <button type="button" onClick={() => catalog.refetch()}>Tentar novamente</button></li>}
          {!catalog.isPending && !catalog.isError && remote.length === 0 && <li className={styles.empty}>Nenhum exercício no catálogo para esta busca.</li>}
          {catalog.hasNextPage && <li><button type="button" className={styles.addExBtn} disabled={catalog.isFetching} onClick={() => catalog.fetchNextPage()}>{catalog.isFetchingNextPage ? 'Carregando…' : 'Carregar mais exercícios'}</button></li>}
        </ul>
        {importExercise.isPending && <p role="status">Adicionando exercício…</p>}
        {importExercise.isError && <p role="alert">Não foi possível adicionar o exercício. Tente novamente.</p>}
        {create.isError && <p role="alert">Não foi possível criar o exercício. Tente novamente.</p>}
        {creating ? (
          <div className={styles.createBox}>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do exercício" />
            <select className={styles.input} value={newMuscle} onChange={(e) => setNewMuscle(e.target.value)}>
              {Object.entries(MUSCLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <button type="button" className={styles.primary} onClick={createOne} disabled={!name.trim() || busy}>Criar e adicionar</button>
          </div>
        ) : (
          <button type="button" className={styles.addExBtn} onClick={() => setCreating(true)}><Plus size={14} /> Criar exercício personalizado</button>
        )}
      </div>
      {info && <div onClick={(e) => e.stopPropagation()}><ExerciseDetail key={info.id} exercise={info} onClose={() => setInfo(null)} onAdd={() => onPick(info)} /></div>}
    </div>
  )
}
