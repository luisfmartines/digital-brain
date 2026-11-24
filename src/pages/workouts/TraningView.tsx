import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Clock, History, Dumbbell, MoreVertical, Pencil, Play, PlayCircle, Plus, Timer, TrendingUp, Zap } from 'lucide-react'
import {
  useActiveWorkout, useDeleteRoutine, useHistory, useLastPerformed, useRoutines, useStartWorkout, useWeekStats, type Routine,
} from '../../features/workouts/queries'
import { estimateMinutes, fmtNum, mins, muscleLabel, relDays } from './helpers'
import styles from './workouts.module.css'

const info = (r: Routine) => ({
  n: r.routine_exercises.length,
  sets: r.routine_exercises.reduce((a, x) => a + x.target_sets, 0),
  muscles: [...new Set(r.routine_exercises.map((x) => muscleLabel(x.exercise.muscle_group)))],
})

export default function TrainingView() {
  const navigate = useNavigate()
  const routineList = useRoutines()
  const routines = routineList.data ?? []
  const last = useLastPerformed().data ?? {}
  const week = useWeekStats().data
  const history = useHistory().data ?? []
  const active = useActiveWorkout().data
  const start = useStartWorkout()
  const remove = useDeleteRoutine()
  const [menuId, setMenuId] = useState<string | null>(null)

  const go = (r?: Routine) => start.mutate(r, { onSuccess: (id) => navigate(`/workouts/active/${id}`) })
  // A "pronta hoje" é a rotina que você treinou há mais tempo (ou nunca)
  const ready = [...routines].sort((a, b) => (last[a.id] ?? '').localeCompare(last[b.id] ?? ''))[0]
  const f = ready ? info(ready) : null
  const delta = week && week.lastVolume > 0 ? ((week.volume - week.lastVolume) / week.lastVolume) * 100 : null

  return (
    <>
      <div className={styles.topRow}>
        <div>
          <span className={styles.protocol}><i /> PROTOCOLO ATIVO</span>
          <h1 className={styles.h1}>Treinos</h1>
          <span className={styles.sub}>Protocolo de Hipertrofia e Desempenho</span>
        </div>
        <button type="button" className={styles.iconBtn} onClick={() => navigate('/workouts/stats?tab=charts')} aria-label="Gráficos e análise"><TrendingUp size={18} /></button>
      </div>

      <Link to="/workouts/stats?tab=charts" className={`${styles.traj} ${styles.trajLink}`}>
        <span className={styles.iconBox}><Zap size={16} /></span>
        <div className={styles.trajText}>
          <strong>Trajetória semanal</strong>
          <small>{week?.count ?? 0} treinos • {fmtNum(week?.volume ?? 0)} kg de volume</small>
        </div>
        {delta !== null && <span className={styles.deltaPill}><TrendingUp size={11} /> {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</span>}
      </Link>

      {active && (
        <button type="button" className={styles.banner} onClick={() => navigate(`/workouts/active/${active.id}`)}>
          <i className={styles.liveDot} /> Treino em andamento: <b>{active.name}</b> <span>Retomar</span>
        </button>
      )}

      <div className={styles.btnRow}>
        <Link to="/workouts/routines/new" className={styles.createBtn}><Plus size={15} /> Criar rotina</Link>
        <button type="button" className={styles.quickBtn} onClick={() => go()} disabled={start.isPending}><Timer size={15} /> Iniciar treino vazio</button>
      </div>

      {start.isError && <p className={styles.error} role="alert">Não foi possível iniciar o treino. Tente novamente.</p>}

      {ready && f && (
        <section className={styles.featured}>
          <div className={styles.rowBetween}>
            <span className={styles.readyPill}><PlayCircle size={12} /> PRONTO PARA HOJE</span>
            <span className={styles.est}><Clock size={12} /> ~{estimateMinutes(ready.routine_exercises)} min</span>
          </div>
          <h2 className={styles.fTitle}>{ready.name}</h2>
          {ready.focus && <span className={styles.fFocus}>{ready.focus}</span>}
          <div className={styles.chipRow}>
            <span className={styles.chip}>{f.n} exercícios</span>
            <span className={styles.chip}>{f.sets} séries no total</span>
          </div>
          {f.muscles.length > 0 && <span className={styles.chipGreen}>{f.muscles.join(', ')}</span>}
          <ul className={styles.exList}>
            {ready.routine_exercises.slice(0, 3).map((r, i) => (
              <li key={r.id}><span>{i + 1}. {r.exercise.name}</span><b>{r.target_sets} {r.target_sets === 1 ? 'série' : 'séries'}</b></li>
            ))}
          </ul>
          <button type="button" className={styles.startBtn} onClick={() => go(ready)} disabled={start.isPending}>Iniciar treino <Play size={14} /></button>
        </section>
      )}

      <div className={styles.sectionHead}>
        <span>Minhas rotinas <i className={styles.count}>{routines.length}</i></span>
        <Link to="/workouts/routines/new" className={styles.link}>Nova +</Link>
      </div>

      {routineList.isPending && <p className={styles.loading} role="status">Carregando rotinas…</p>}
      {routineList.isError && <p className={styles.error} role="alert">Não foi possível carregar as rotinas. <button type="button" onClick={() => routineList.refetch()}>Tentar novamente</button></p>}
      {routineList.isSuccess && routines.length === 0 && <p className={styles.empty}>Nenhuma rotina ainda. Crie a primeira para começar por aqui.</p>}

      <ul className={styles.list}>
        {routines.map((r) => {
          const i = info(r)
          return (
            <li key={r.id} className={styles.routine}>
              <div className={styles.rHead}>
                <span className={styles.iconBox}><Dumbbell size={16} /></span>
                <div className={styles.rText}>
                  <strong>{r.name}</strong>
                  <small>{i.muscles.slice(0, 2).join(' & ') || 'Nenhum exercício'} • {i.n} exercícios • {i.sets} séries</small>
                </div>
                <Link to={`/workouts/routines/${r.id}/edit`} className={styles.plainBtn} aria-label="Editar rotina"><Pencil size={14} /></Link>
                <div className={styles.menuWrap}>
                  <button type="button" className={styles.plainBtn} onClick={() => setMenuId(menuId === r.id ? null : r.id)} aria-label="Opções da rotina"><MoreVertical size={16} /></button>
                  {menuId === r.id && (
                    <div className={styles.menu}>
                      <button type="button" onClick={() => { setMenuId(null); if (window.confirm(`Excluir “${r.name}”?`)) remove.mutate(r.id) }}>Excluir</button>
                    </div>
                  )}
                </div>
              </div>
              {r.tags.length > 0 && <div className={styles.chipRow}>{r.tags.map((t) => <span key={t} className={styles.chipGreen}>{t}</span>)}</div>}
              <div className={styles.rFoot}>
                <span className={styles.last}><History size={13} /> {last[r.id] ? `Último treino ${relDays(last[r.id]).toLowerCase()}` : 'Ainda não realizado'}</span>
                <button type="button" className={styles.quickStart} onClick={() => go(r)} disabled={start.isPending}>Início rápido <Play size={12} /></button>
              </div>
            </li>
          )
        })}
      </ul>

      {history.length > 0 && (
        <>
          <div className={styles.sectionHead}>
            <span>Histórico recente <i className={styles.hintTag}>Sincronização</i></span>
            <Link to="/workouts/stats?tab=history" className={`${styles.link} ${styles.linkIcon}`}>Registro <ArrowRight size={13} /></Link>
          </div>
          <ul className={styles.list}>
            {history.map((h) => (
              <li key={h.id} className={styles.hItem}>
                <span className={styles.hIcon}><Check size={14} /></span>
                <div className={styles.rText}>
                  <strong>{h.name} <i className={styles.hintTag}>{relDays(h.ended_at)}</i></strong>
                  <small>{mins(h.seconds)} min • {fmtNum(h.volume)} kg de volume</small>
                </div>
                <div className={styles.hRight}><strong>{h.pct}%</strong><small>Concluído</small></div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}