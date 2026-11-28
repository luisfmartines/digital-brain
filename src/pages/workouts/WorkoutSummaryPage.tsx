import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Layers, Maximize2, Share2, Sparkles, Timer, TrendingUp, Trophy, X, Zap } from 'lucide-react'
import Splash from '../../components/layout/Splash'
import Avatar from '../../components/ui/Avatar'
import { useDevice } from '../../expo/device'
import { useProfile } from '../../features/profile/useProfile'
import { useSession, useSummaryExtras } from '../../features/workouts/queries'
import { fmtNum, mins, muscleLabel, volumeOf, workoutSeconds } from '../../features/workouts/utils'
import styles from './workouts.module.css'
import WorkoutReview from './WorkoutReview'
import FinishedWorkoutPhotos from './FinishedWorkoutPhotos'

export default function WorkoutSummaryPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const device = useDevice()
  const [shareNotice, setShareNotice] = useState('')
  const fromLogbook = useLocation().state?.fromLogbook === true
  const back = () => navigate(fromLogbook ? '/workouts/stats?tab=history' : '/workouts', { replace: true })
  const { data: profile } = useProfile()
  const { data: session, isLoading } = useSession(id)
  const extras = useSummaryExtras(session)
  if (isLoading) return <Splash />
  if (!session) return <Navigate to="/workouts" replace />
  if (!session.ended_at) return params.get('review') === '1'
    ? <WorkoutReview key={id} session={session} updateRoutine={params.get('updateRoutine') === '1'} />
    : <Navigate to={`/workouts/active/${id}`} replace />
  if (params.has('review')) return <Navigate to={`/workouts/summary/${id}`} replace />

  const sets = session.workout_sets
  const done = sets.filter((s) => s.completed)
  const work = done.filter((s) => !s.is_warmup)
  const volume = volumeOf(sets)
  const secs = workoutSeconds(session, 0)
  const pct = sets.length ? Math.round((done.length / sets.length) * 100) : 0
  const exercises = new Set(done.map((s) => s.exercise_id)).size
  const reps = done.reduce((a, s) => a + (s.reps ?? 0), 0)
  const xp = extras.data?.xp ?? null
  const prevVol = extras.data?.prevVolume ?? null
  const diff = prevVol === null ? null : volume - prevVol

  // Recordes de carga (só conta se já existia um registro anterior)
  const prs = [...new Set(work.map((s) => s.exercise_id))]
    .map((exId) => {
      const own = work.filter((s) => s.exercise_id === exId)
      const best = Math.max(...own.map((s) => s.weight_kg ?? 0))
      const before = extras.data?.bests.get(exId)
      if (before === undefined || best <= before || best <= 0) return null
      const top = own.filter((s) => (s.weight_kg ?? 0) === best).sort((a, b) => (b.reps ?? 0) - (a.reps ?? 0))[0]
      return { name: own[0].exercise.name, best, diff: best - before, reps: top.reps ?? 0 }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // Distribuição por músculo (por volume; sem carga, por número de séries)
  const useVol = volume > 0
  const byMuscle = new Map<string, number>()
  for (const s of done) byMuscle.set(s.exercise.muscle_group, (byMuscle.get(s.exercise.muscle_group) ?? 0) + (useVol ? (s.weight_kg ?? 0) * (s.reps ?? 0) : 1))
  const total = [...byMuscle.values()].reduce((a, b) => a + b, 0)
  const muscles = [...byMuscle.entries()].sort((a, b) => b[1] - a[1]).map(([m, v]) => ({ m, pct: total ? Math.round((v / total) * 100) : 0 }))

  const end = new Date(session.ended_at)
  const photos = session.photo_urls?.length ? session.photo_urls : session.photo_url ? [session.photo_url] : []
  const shareText = `Concluí ${session.name} no Hebbian. ${mins(secs)} min, ${done.length} séries e ${fmtNum(volume)} kg de volume.`

  async function shareOutsideApp() {
    setShareNotice('')
    try {
      if (device) {
        await device.shareText(shareText)
      } else if (navigator.share) {
        await navigator.share({ title: 'Meu treino no Hebbian', text: shareText })
      } else {
        await navigator.clipboard.writeText(shareText)
        setShareNotice('Resumo copiado.')
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setShareNotice('Não foi possível compartilhar o resumo. Tente novamente.')
      }
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={back} aria-label="Voltar"><ArrowLeft size={20} /></button>
          <h1 className={styles.headerTitle}>Resumo do treino</h1>
          <button type="button" className={styles.back} onClick={back} aria-label="Fechar"><X size={20} /></button>
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={30} />
        </header>

        <section className={styles.sHero}>
          <span className={styles.trophy}><Trophy size={26} /></span>
          <h2>Treino concluído!</h2>
          <small>{session.name} • {end.toLocaleDateString('pt-BR', { weekday: 'long', month: 'short', day: 'numeric' })}</small>
          {xp !== null && <span className={styles.xpPill}><Sparkles size={13} /> +{xp} XP ganhos</span>}
        </section>

        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <span className={styles.cap}>Duração <Timer size={14} /></span>
            <strong className={styles.statBig}>{mins(secs)} <small>min</small></strong>
            <small className={styles.accentSm}>{done.length} séries registradas</small>
          </div>
          <div className={styles.statCard}>
            <span className={styles.cap}>Volume total {prs.length > 0 && <i className={styles.prTag}>REC</i>}</span>
            <strong className={styles.statBig}>{fmtNum(volume)} <small>kg</small></strong>
            <small className={styles.accentSm}>
              {diff === null ? 'Primeiro treino registrado' : `${diff >= 0 ? '+' : '−'}${fmtNum(Math.abs(diff))} kg vs. treino anterior de ${session.name}`}
            </small>
          </div>
          <div className={styles.statCard}>
            <span className={styles.cap}>Séries concluídas <Maximize2 size={14} /></span>
            <strong className={styles.statBig}>{done.length} <small>séries</small></strong>
            <small className={styles.accentSm}>{pct}% das séries planejadas</small>
          </div>
          <div className={styles.statCard}>
            <span className={styles.cap}>Exercícios <Layers size={14} /></span>
            <strong className={styles.statBig}>{exercises} <small>concluídos</small></strong>
            <small className={styles.accentSm}>{fmtNum(reps)} repetições no total</small>
          </div>
        </div>

        {muscles.length > 0 && (
          <section className={styles.panel}>
            <div className={styles.sectionHead}><span><i className={styles.dot} /> Distribuição muscular</span><em className={styles.hintTag}>Carga relativa</em></div>
            <div className={styles.muscleBar}>
              {muscles.map((m, i) => <i key={m.m} style={{ width: `${m.pct}%`, opacity: 1 - i * 0.18 }} />)}
            </div>
            <div className={styles.muscleChips}>
              {muscles.slice(0, 3).map((m) => <div key={m.m}><small>● {muscleLabel(m.m)}</small><strong>{m.pct}%</strong></div>)}
            </div>
            <p className={styles.vector}>
              <b>Estímulo principal:</b> {muscles.slice(0, 2).map((m) => muscleLabel(m.m)).join(' & ')}.
            </p>
          </section>
        )}

        {prs.length > 0 && (
          <section className={styles.panel}>
            <div className={styles.sectionHead}><span><Trophy size={14} /> Novos recordes</span><em className={styles.badge}>{prs.length} {prs.length === 1 ? 'marca' : 'marcas'}</em></div>
            {prs.map((p) => (
              <div key={p.name} className={styles.prRow}>
                <span className={styles.iconBox}><TrendingUp size={15} /></span>
                <div className={styles.rText}><strong>{p.name}</strong><small>{p.reps} repetições</small></div>
                <div className={styles.prRight}><strong>{p.best} kg</strong><em>+{Number(p.diff.toFixed(2))} kg PR <Zap size={10} /></em></div>
              </div>
            ))}
          </section>
        )}

        <FinishedWorkoutPhotos workoutId={session.id} photos={photos} />

        <button type="button" className={styles.primary}
          onClick={() => fromLogbook ? back() : navigate('/?tab=feed', { replace: true })}>
          Continuar <ArrowRight size={15} />
        </button>
        <button type="button" className={styles.cancel} onClick={() => void shareOutsideApp()}>
          <Share2 size={15} /> Compartilhar
        </button>
        {shareNotice && <p className={styles.publishNote} role="status">{shareNotice}</p>}
      </div>
    </div>
  )
}
