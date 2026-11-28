import ChoiceField from '../../components/ui/ChoiceField'
import PhotoPicker from '../../components/ui/PhotoPicker'
import { useEffect, useState } from 'react'
import { ImagePlus, Info, Pencil, Plus, Search, X } from 'lucide-react'
import { useAuth } from '../../features/auth/useAuth'
import { isCustomExercise, useCreateExercise, useExercises, type Exercise } from '../../features/workouts/queries'
import { MUSCLES, muscleLabel } from '../../features/workouts/utils'
import ExerciseDetail from './ExerciseDetail'
import EditExerciseDialog from './EditExerciseDialog'
import styles from './workouts.module.css'
import { useExerciseCatalog, useImportExercise } from '../../features/exercisedb/queries'
import { exerciseGroup, muscleName } from '../../features/exercisedb/api'
import type { ExerciseMedia } from '../../features/exercisedb/types'
import ExerciseImage, { SavedExerciseImage } from './ExerciseImage'
import { translateText } from '../../features/exercisedb/translate'
import { catalogSearchEquipment, catalogSearchNames, prepareExerciseSearch, rankExercises } from '../../features/exercisedb/search'

type PickResult = { source: 'saved'; exercise: Exercise } | { source: 'catalogue'; exercise: ExerciseMedia }

export default function ExercisePicker({ onPick, onClose, title = 'Adicionar exercício', excludedIds = [], error, saving = false }: {
  onPick: (e: Exercise) => void; onClose: () => void; title?: string; excludedIds?: string[]; error?: string; saving?: boolean
}) {
  const saved = useExercises()
  const { user } = useAuth()
  const all = saved.data ?? []
  const create = useCreateExercise()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [creating, setCreating] = useState(false)
  const [info, setInfo] = useState<Exercise | null>(null)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [catalogInfo, setCatalogInfo] = useState<ExerciseMedia | null>(null)
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null)
  const [name, setName] = useState('')
  const [newMuscle, setNewMuscle] = useState('chest')
  const [term, setTerm] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(q.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [q])
  const preview = photo?.preview
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const catalog = useExerciseCatalog(term, muscle)
  const importExercise = useImportExercise()
  const remote = catalog.data?.pages.flatMap((page) => page.exercises) ?? []
  const busy = saving || importExercise.isPending || create.isPending

  const byCatalogId = new Map(remote.map((exercise) => [exercise.id, exercise]))
  const savedCatalogIds = new Set<string>()
  const savedResults = all.flatMap((exercise) => {
    const prefix = exercise.user_id ? exercise.user_id + ':' : ''
    const catalogId = prefix && exercise.id.startsWith(prefix) ? exercise.id.slice(prefix.length) : ''
    const catalogExercise = byCatalogId.get(catalogId)
    if (catalogId) savedCatalogIds.add(catalogId)
    if (excludedIds.includes(exercise.id) || (muscle && exercise.muscle_group !== muscle && !catalogExercise)) return []
    return [prepareExerciseSearch<PickResult>({
      item: { source: 'saved', exercise },
      names: [exercise.name, ...(catalogExercise ? catalogSearchNames(catalogExercise) : [])],
      equipment: exercise.equipment ? [exercise.equipment] : [],
    })]
  })
  const catalogResults = remote.filter((exercise) => !savedCatalogIds.has(exercise.id)).map((exercise) =>
    prepareExerciseSearch<PickResult>({
      item: { source: 'catalogue', exercise },
      names: catalogSearchNames(exercise),
      equipment: catalogSearchEquipment(exercise),
    }))
  const results = rankExercises([...savedResults, ...catalogResults], term)
  const waitingForSearch = q.trim() !== term || catalog.isPending

  function close() {
    if (!create.isPending) onClose()
  }

  function createOne() {
    if (!name.trim() || busy) return
    create.mutate({ name: name.trim(), muscle_group: newMuscle, photo: photo?.file ?? null }, { onSuccess: (e) => onPick(e) })
  }

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHead}>
          <strong>{creating ? 'Criar exercício personalizado' : title}</strong>
          <button type="button" className={styles.plainBtn} onClick={close} disabled={create.isPending} aria-label="Fechar"><X size={18} /></button>
        </div>
        {!creating && (
          <>
            <label className={styles.search}><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar exercícios" /></label>
            <div className={styles.filterChips}>
              <button type="button" className={muscle === '' ? styles.fOn : styles.f} onClick={() => setMuscle('')}>Todos</button>
              {Object.entries(MUSCLES).map(([id, label]) => (
                <button key={id} type="button" className={muscle === id ? styles.fOn : styles.f} onClick={() => setMuscle(id)}>{label}</button>
              ))}
            </div>
            <ul className={styles.pickList}>
              {waitingForSearch && <li className={styles.empty} role="status">Carregando exercícios…</li>}
              {q.trim() === term && results.map((result) => {
                if (result.source === 'saved') {
                  const exercise = result.exercise
                  const custom = isCustomExercise(exercise, user?.id)
                  return (
                    <li key={exercise.id} className={styles.pickRow}>
                      {custom && <button type="button" className={styles.editExerciseThumb}
                        onClick={() => setEditing(exercise)} aria-label={`Editar ${exercise.name}`}><SavedExerciseImage exercise={exercise} fallback={<Pencil size={16} />} /></button>}
                      <button type="button" className={styles.catalogExercise} disabled={busy} onClick={() => onPick(exercise)}>
                        {!custom && <SavedExerciseImage exercise={exercise} />}
                        <span><strong>{exercise.name}</strong><small>{muscleLabel(exercise.muscle_group)}{exercise.equipment ? ` • ${exercise.equipment}` : ''}</small></span>
                      </button>
                      <button type="button" className={styles.pickInfo} onClick={() => setInfo(exercise)} aria-label={`Ver detalhes de ${exercise.name}`}><Info size={18} /></button>
                    </li>
                  )
                }
                const exercise = result.exercise
                return (
                  <li key={exercise.id} className={styles.pickRow}>
                    <button type="button" className={styles.catalogExercise} disabled={busy} onClick={() => importExercise.mutate(exercise, { onSuccess: onPick })}>
                      <ExerciseImage src={exercise.imageUrl} externalId={exercise.id} name={exercise.name} />
                      <span><strong>{exercise.name}</strong><small>{exercise.targets.map(muscleName).join(', ')}{exercise.equipments.length > 0 && ` • ${exercise.equipments.map(translateText).join(', ')}`}</small></span>
                      <Plus size={18} aria-hidden="true" />
                    </button>
                    <button type="button" className={styles.pickInfo} onClick={() => { importExercise.reset(); setCatalogInfo(exercise) }} aria-label={`Ver detalhes de ${exercise.name}`}><Info size={18} /></button>
                  </li>
                )
              })}
              {saved.isError && <li className={styles.empty}>Não foi possível carregar os exercícios salvos. <button type="button" onClick={() => saved.refetch()}>Tentar novamente</button></li>}
              {catalog.isError && <li className={styles.empty}>Não foi possível carregar o catálogo. <button type="button" onClick={() => catalog.refetch()}>Tentar novamente</button></li>}
              {!waitingForSearch && !catalog.isError && !catalog.hasNextPage && results.length === 0 && <li className={styles.empty}>Nenhum exercício encontrado.</li>}
              {q.trim() === term && catalog.hasNextPage && <li><button type="button" className={styles.addExBtn} disabled={catalog.isFetching} onClick={() => catalog.fetchNextPage()}>{catalog.isFetchingNextPage ? 'Carregando…' : 'Carregar mais exercícios'}</button></li>}
            </ul>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {importExercise.isPending && <p role="status">Adicionando exercício…</p>}
        {importExercise.isError && <p role="alert">Não foi possível adicionar o exercício. Tente novamente.</p>}
        {create.isError && <p role="alert">{create.error.message}</p>}
        {creating ? (
          <div className={styles.createBox}>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do exercício" />
            <ChoiceField label="Grupo muscular" value={newMuscle} onChange={setNewMuscle}
              options={Object.entries(MUSCLES).map(([value, label]) => ({ value, label }))} />
            <PhotoPicker title="Foto do exercício" onPhoto={(file) => {
              setPhoto({ file, preview: URL.createObjectURL(file) })
              create.reset()
            }}>
              {(open) => (
                <button type="button" className={styles.exercisePhotoField} data-selected={!!photo} disabled={busy}
                  aria-haspopup="dialog" aria-label={photo ? 'Trocar foto do exercício' : 'Adicionar foto do exercício'} onClick={open}>
                  {photo ? (
                    <>
                      <img src={photo.preview} alt="Prévia da foto do exercício" />
                      <span>Trocar foto</span>
                    </>
                  ) : (
                    <>
                      <ImagePlus size={26} aria-hidden="true" />
                      <span>Adicionar foto</span>
                      <small>Opcional</small>
                    </>
                  )}
                </button>
              )}
            </PhotoPicker>
            {photo && <button type="button" className={styles.addSet} disabled={busy} onClick={() => {
              setPhoto(null)
              create.reset()
            }}>Remover foto</button>}
            <button type="button" className={styles.primary} onClick={createOne} disabled={!name.trim() || busy}>{create.isPending ? 'Salvando…' : 'Criar e adicionar'}</button>
            <button type="button" className={styles.cancel} disabled={busy} onClick={() => setCreating(false)}>Voltar aos exercícios</button>
          </div>
        ) : (
          <button type="button" className={styles.addExBtn} onClick={() => setCreating(true)}><Plus size={14} /> Criar exercício personalizado</button>
        )}
      </div>
      {info && <div onClick={(e) => e.stopPropagation()}><ExerciseDetail key={info.id} exercise={info} onClose={() => setInfo(null)} onAdd={() => onPick(info)} adding={saving} addError={error} addLabel={title} /></div>}
      {editing && <div onClick={(event) => event.stopPropagation()}><EditExerciseDialog exercise={editing} onClose={() => setEditing(null)} /></div>}
      {catalogInfo && <div onClick={(e) => e.stopPropagation()}><ExerciseDetail
        key={catalogInfo.id}
        exercise={{ id: catalogInfo.id, name: catalogInfo.name, muscle_group: exerciseGroup(catalogInfo), equipment: catalogInfo.equipments.map(translateText).join(', ') || null, user_id: null }}
        previewMedia={catalogInfo}
        onClose={() => setCatalogInfo(null)}
        onAdd={() => importExercise.mutate(catalogInfo, { onSuccess: onPick })}
        adding={busy}
        addError={error || (importExercise.isError ? 'Não foi possível importar o exercício. Tente novamente.' : undefined)}
        addLabel={title}
      /></div>}
    </div>
  )
}
