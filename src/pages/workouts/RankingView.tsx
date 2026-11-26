import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Crown, Plus, TrendingUp, Trophy } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { useAuth } from '../../features/auth/useAuth'
import { useLeaderboard, type Rival } from '../../features/social/queries'
import { useRoutines, useStartWorkout } from '../../features/workouts/queries'
import { fmtNum } from '../../features/workouts/utils'
import { addDays, startOfWeek } from '../../lib/date'
import styles from './workouts.module.css'

type Metric = 'volume' | 'time' | 'sets'
const METRICS: { id: Metric; label: string; sub: string }[] = [
  { id: 'volume', label: 'Carga levantada', sub: 'VOLUME' },
  { id: 'time', label: 'Tempo na academia', sub: 'Horas' },
  { id: 'sets', label: 'Séries', sub: 'Repetições e séries' },
]

const valueOf = (r: Rival, m: Metric) => (m === 'volume' ? r.volume_kg : m === 'time' ? r.minutes : r.sets)

export default function RankingView() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const routines = useRoutines().data ?? []
  const start = useStartWorkout()
  const [today] = useState(() => new Date())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const [metric, setMetric] = useState<Metric>('volume')
  const board = useLeaderboard(weekStart)

  const isCurrent = weekStart.getTime() === startOfWeek(today).getTime()
  const weekEnd = addDays(weekStart, 6)
  const sorted = [...(board.data ?? [])].sort((a, b) => valueOf(b, metric) - valueOf(a, metric))
  const myIdx = sorted.findIndex((r) => r.user_id === user?.id)
  const me = myIdx >= 0 ? sorted[myIdx] : null
  const leader = sorted[0]
  const gap = me && leader && leader.user_id !== me.user_id ? valueOf(leader, metric) - valueOf(me, metric) : null
  const daysLeft = Math.max(0, Math.ceil((addDays(weekStart, 7).getTime() - today.getTime()) / 86400000))
  const range = `${weekStart.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}`
  const gapText = (g: number) => (metric === 'time' ? `${(g / 60).toFixed(1)} h` : metric === 'sets' ? `${fmtNum(g)} séries` : `${fmtNum(g)} kg`)
  const fmtValue = (v: number, m: Metric) => (m === 'volume' ? `${fmtNum(v)} kg` : m === 'time' ? `${(v / 60).toFixed(1)} h` : `${fmtNum(v)} séries`)

  // Pódio: 2º, 1º, 3º
  const podium = [sorted[1], sorted[0], sorted[2]]
  const place = [2, 1, 3]
  const profilePath = (r: Rival) => r.user_id === user?.id ? '/profile' : `/profiles/${r.user_id}`

  return (
    <>
      <div className={styles.rowBetween}>
        <h1 className={styles.h1}><i className={styles.dot} /> Treinos</h1>
        <span className={styles.pill}><i className={styles.dot} /> COMPETIÇÃO AO VIVO</span>
      </div>

      <div className={styles.weekNav}>
        <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}         aria-label="Semana anterior"><ChevronLeft size={16} /></button>
        <strong>{range}</strong>
        <button type="button" disabled={isCurrent} onClick={() => setWeekStart(addDays(weekStart, 7))}         aria-label="Próxima semana"><ChevronRight size={16} /></button>
      </div>
      <span className={styles.sub}>{sorted.length} {sorted.length === 1 ? 'atleta' : 'atletas'} no seu círculo</span>

      <div className={styles.metricTabs}>
        {METRICS.map((m) => (
          <button key={m.id} type="button" className={metric === m.id ? styles.metricOn : ''} onClick={() => setMetric(m.id)}>
            {m.label}<small>{m.sub}</small>
          </button>
        ))}
      </div>

      <div className={styles.podium}>
        {podium.map((r, i) =>
          r ? (
            <Link key={r.user_id} to={profilePath(r)} className={`${styles.podCol} ${styles.profileLink} ${place[i] === 1 ? styles.podFirst : ''}`}>
              {place[i] === 1 ? <span className={styles.crown}><Crown size={11} /> #1 LÍDER</span> : <span className={styles.rankTag}><Trophy size={11} /> #{place[i]}</span>}
              <Avatar url={r.avatar_url} name={r.display_name} size={place[i] === 1 ? 54 : 44} />
              {r.user_id === user?.id && <span className={styles.youTag}>VOCÊ</span>}
              <strong>{r.display_name?.split(' ')[0] ?? r.username ?? 'Atleta'}</strong>
              <b className={place[i] === 1 ? styles.podGold : ''}>{fmtValue(valueOf(r, metric), metric)}</b>
              <small>⚡ +{r.xp} XP</small>
            </Link>
          ) : (
            <div key={`empty-${i}`} className={styles.podCol}><span className={styles.rankTag}>#{place[i]}</span><small>Posição livre</small></div>
          )
        )}
      </div>

      <section className={styles.deltaCard}>
        <span className={styles.iconBox}><TrendingUp size={15} /></span>
        <div className={styles.rText}>
          <strong>{gap !== null ? `Diferença: +${gapText(gap)} para o 1º` : me ? 'Você lidera esta semana' : 'Sem dados nesta semana'}</strong>
          <small>{isCurrent ? `${daysLeft} ${daysLeft === 1 ? 'dia restante' : 'dias restantes'} no ciclo` : 'Ciclo encerrado'}</small>
        </div>
      </section>

      {sorted.length > 3 && (
        <>
          <div className={styles.rowBetween}>
            <span className={styles.cap}>LISTA DE DESAFIANTES</span>
            <span className={styles.accentSm}>Ordenado por {metric === 'volume' ? 'tonelagem total' : metric === 'time' ? 'tempo na academia' : 'séries'}</span>
          </div>
          <ul className={styles.list}>
            {sorted.slice(3).map((r, i) => (
              <li key={r.user_id}>
                <Link to={profilePath(r)} className={`${styles.rosterRow} ${styles.profileLink}`}>
                  <span className={styles.rankNum}>{i + 4}</span>
                  <Avatar url={r.avatar_url} name={r.display_name} size={36} />
                  <div className={styles.rText}><strong>{r.display_name ?? r.username ?? 'Atleta'}</strong>{r.last_workout && <small>● {r.last_workout}</small>}</div>
                  <div className={styles.prRight}><strong>{fmtValue(valueOf(r, metric), metric)}</strong><em>+{r.xp} XP</em></div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {me && (
        <section className={styles.yourRank}>
          <Avatar url={me.avatar_url} name={me.display_name} size={40} />
          <div className={styles.rText}>
            <strong>Sua classificação <span className={styles.badge}>TOP {Math.max(1, Math.ceil(((myIdx + 1) / sorted.length) * 100))}%</span></strong>
            <small>{gap !== null ? `Faltam ${gapText(gap + 1)} para conquistar a 1ª posição` : 'Você mantém a 1ª posição'}</small>
          </div>
          <button
            type="button"
            className={styles.smallBtn}
            disabled={start.isPending}
            onClick={() => start.mutate(routines[0], { onSuccess: (id) => navigate(`/workouts/active/${id}`) })}
          >
            <Plus size={13} /> Registrar carga
          </button>
        </section>
      )}
    </>
  )
}
