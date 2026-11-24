import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useExercises } from '../../features/workouts/queries'
import ExerciseDetail from './ExerciseDetail'
import styles from './workouts.module.css'

// Abre o detalhe de um exercício por link (ex.: /workouts/exercises/:id)
export default function ExerciseDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useExercises()
  if (isLoading) return <p className={styles.loading}>Carregando…</p>
  const exercise = data?.find((e) => e.id === id)
  if (!exercise) return <Navigate to="/workouts" replace />
  return <ExerciseDetail exercise={exercise} onClose={() => (window.history.length > 1 ? navigate(-1) : navigate('/workouts', { replace: true }))} />
}
