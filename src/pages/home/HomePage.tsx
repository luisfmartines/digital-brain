import type { ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, Check, CheckCircle2, ChevronRight, Clock, Droplet, Flame, Lightbulb, Dumbbell, Play, Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useProfile } from '../../features/profile/useProfile'
import {
  useMonthFinance, useTasksSummary, useTodayHabits, useToggleHabit, useWorkoutsToday,
} from '../../features/home/queries'
import { WATER_STEP, litersLabel, useAddWater, useWater } from '../../features/water/queries'
import SocialFeed from '../social/SocialFeed'
import { useLastPerformed, useRoutines, useStartWorkout } from '../../features/workouts/queries'
import { estimateMinutes, muscleLabel } from '../../features/workouts/utils'
import { useOnline } from '../../hooks/useOnline'
import { dayOfYear } from '../../lib/date'
import { formatBRL } from '../../features/onboarding/utils'
import styles from './Home.module.css'

const QUOTES = [
  'O impulso cognitivo nasce da eliminação da fadiga de escolher.',
  'Pequenas ações, repetidas diariamente, tornam-se identidade.',
  'O que é programado é feito.',
  'Consistência supera intensidade quando ela não é sustentável.',
  'Proteja a sequência, não o humor.',
]

function taskLine(t: { due_at: string | null; notes: string | null } | null) {
  if (!t) return 'Adicione sua primeira tarefa'
  if (!t.due_at) return t.notes ?? 'Sem horário definido'
  const d = new Date(t.due_at)
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === new Date().toDateString()) return `Programada para ${time}`
  return `${d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })} · ${time}`
}

interface HeroRow { key: string; icon: LucideIcon; label: string; text: string; ratio: number; counts: boolean; action?: ReactNode; to?: string }

function Overview() {
  const { data: profile } = useProfile()
  const tasks = useTasksSummary()
  const habits = useTodayHabits()
  const toggle = useToggleHabit()
  const finance = useMonthFinance()
  const water = useWater()
  const addWater = useAddWater()
  const workoutsToday = useWorkoutsToday().data ?? 0
  const routines = useRoutines().data ?? []
  const last = useLastPerformed().data ?? {}
  const startWorkout = useStartWorkout()
  const online = useOnline()
  const navigate = useNavigate()

  const modules: string[] = profile?.enabled_modules ?? []
  const has = (m: string) => modules.includes(m)
  const firstName = profile?.display_name?.split(' ')[0] ?? ''
  const today = tasks.data?.today ?? 0

  const now = new Date()
  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'short', month: 'short', day: 'numeric' })
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const elapsed = now.getDate() / daysInMonth
  const remainingDays = daysInMonth - now.getDate() + 1

  const fin = finance.data
  const margin = fin?.margin ?? 0
  const onTrack = !fin || (margin >= 0 && (fin.income === 0 || fin.spent / fin.income <= elapsed + 0.05))
  const burn = Math.max(0, margin) / remainingDays

  const habitList = habits.data?.habits ?? []
  const doneCount = habitList.filter((h) => h.done).length
  const streak = habits.data?.streak ?? 0

  const ml = water.data?.ml ?? 0
  const goal = water.data?.goal ?? 2500
  const tasksTotal = (tasks.data?.doneToday ?? 0) + (tasks.data?.dueNow ?? 0)

  const rows: HeroRow[] = []
  if (has('habits')) rows.push({ key: 'habits', icon: Flame, label: 'Hábitos', text: `${doneCount}/${habitList.length} hábitos`, ratio: habitList.length ? doneCount / habitList.length : 0, counts: habitList.length > 0 })
  if (has('tasks')) rows.push({ key: 'tasks', icon: CheckCircle2, label: 'Tarefas', text: `${tasks.data?.doneToday ?? 0}/${tasksTotal} tarefas`, ratio: tasksTotal ? (tasks.data?.doneToday ?? 0) / tasksTotal : 0, counts: tasksTotal > 0 })
  rows.push({
    key: 'water', icon: Droplet, label: 'Água', text: `${litersLabel(ml)} / ${litersLabel(goal)}`, ratio: goal ? ml / goal : 0, counts: true,
    to: '/routine?tab=habits&edit=water', // toca no nome para ajustar a meta (de 500 em 500 ml)
    action: <button type="button" className={styles.heroPlus} onClick={() => addWater.mutate(WATER_STEP)} disabled={addWater.isPending} aria-label={`Adicionar ${WATER_STEP} ml de água`}>+{WATER_STEP}</button>,
  })
  if (has('workouts')) rows.push({ key: 'workout', icon: Dumbbell, label: 'Treino', text: `${Math.min(workoutsToday, 1)}/1 treino`, ratio: Math.min(workoutsToday, 1), counts: true })
  const counted = rows.filter((r) => r.counts)
  const overall = counted.length ? Math.round((counted.reduce((a, r) => a + Math.min(1, r.ratio), 0) / counted.length) * 100) : 0

  // Rotina "pronta hoje": a que você treinou há mais tempo
  const ready = [...routines].sort((a, b) => (last[a.id] ?? '').localeCompare(last[b.id] ?? ''))[0]
  const readyMuscles = ready ? [...new Set(ready.routine_exercises.map((x) => muscleLabel(x.exercise.muscle_group)))].slice(0, 2).join(' & ') : ''

  function startReady() {
    if (!ready) return navigate('/workouts/routines/new')
    startWorkout.mutate(ready, { onSuccess: (id) => navigate(`/workouts/active/${id}`) })
  }

  return (
    <>
      <div className={styles.topRow}>
        <span className={styles.pill}>
          <i className={online ? styles.dot : styles.dotOff} />
          {online ? 'Online' : 'Sem conexão'}
        </span>
        <span className={styles.date}>{dateLabel}</span>
      </div>

      <h1 className={styles.hello}>Olá{firstName && <>{', '}<span>{firstName}</span></>}</h1>
      <p className={styles.sub}>Sua mente está limpa, {today} {today === 1 ? 'prioridade agendada' : 'prioridades agendadas'} para hoje.</p>

      <section className={styles.hero} aria-label="Progresso de hoje">
        <div className={styles.heroPct}>
          <strong>{overall}%</strong>
          <small>concluído hoje</small>
        </div>
        <ul className={styles.heroRows}>
          {rows.map((r) => (
            <li key={r.key}>
              <div className={styles.heroLine}>
                {r.to ? (
                  <Link to={r.to} className={styles.heroLink}><r.icon size={13} /> {r.label} <ChevronRight size={11} /></Link>
                ) : (
                  <span><r.icon size={13} /> {r.label}</span>
                )}
                <b>{r.text}</b>
                {r.action}
              </div>
              <span className={styles.heroBar}><i style={{ width: `${Math.min(100, r.ratio * 100)}%` }} /></span>
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.sectionRow}>
        <h2>Resumo do dia</h2>
      </div>

      {has('tasks') && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><CheckCircle2 size={18} /></span>
            <div className={styles.titleBox}>
              <span className={styles.cap}>Próxima tarefa</span>
              <strong>{tasks.data?.next?.title ?? 'Nenhuma tarefa ainda'}</strong>
            </div>
            <span className={styles.badge}>{tasks.data?.pending ?? 0} {tasks.data?.pending === 1 ? 'pendente' : 'pendentes'}</span>
          </div>
          <Link to="/routine?tab=tasks" className={styles.strip}>
            <Clock size={14} />
            <span className={styles.stripText}>{taskLine(tasks.data?.next ?? null)}</span>
            <ArrowRight size={14} />
          </Link>
        </section>
      )}

      {has('habits') && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Flame size={18} /></span>
            <div className={styles.titleBox}>
              <span className={styles.cap}>Hábitos</span>
              <strong>{streak > 0 ? `Sequência ativa de ${streak} dias` : 'Hábitos de hoje'}</strong>
            </div>
            <span className={styles.meta}>{doneCount} de {habitList.length} concluídos</span>
          </div>
          {habitList.length > 0 ? (
            <div className={styles.habitGrid}>
              {habitList.slice(0, 4).map((h) => (
                <button key={h.id} type="button" className={styles.habit} onClick={() => toggle.mutate({ habitId: h.id, done: h.done })}>
                  <span className={`${styles.box} ${h.done ? styles.boxOn : ''}`}>{h.done && <Check size={12} />}</span>
                  <span className={h.done ? styles.struck : ''}>{h.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <Link to="/routine?tab=habits" className={styles.strip}>
              <span className={styles.stripText}>Nenhum hábito programado hoje</span>
              <ArrowRight size={14} />
            </Link>
          )}
        </section>
      )}

      {has('workouts') && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Dumbbell size={18} /></span>
            <div className={styles.titleBox}>
              <span className={styles.cap}>Treino sugerido</span>
              <strong>{ready?.name ?? 'Nenhuma rotina ainda'}</strong>
            </div>
            <button type="button" className={styles.start} onClick={startReady} disabled={startWorkout.isPending}><Play size={11} /> {ready ? 'Iniciar' : 'Criar'}</button>
          </div>
          <div className={styles.footRow}>
            <span>{ready ? (ready.focus ?? (readyMuscles || 'Pronto quando você estiver')) : 'Crie sua primeira rotina'}</span>
            {ready && <span className={styles.accent}>{ready.routine_exercises.length} exercícios • {estimateMinutes(ready.routine_exercises)} min</span>}
          </div>
        </section>
      )}

      {has('finance') && (
        <section className={styles.card}>
          <div className={`${styles.cardHead} ${styles.financeHead}`}>
            <span className={styles.iconBox}><Wallet size={18} /></span>
            <div className={styles.titleBox}>
              <span className={styles.cap}>Saldo do mês</span>
              <strong>{formatBRL(margin)}</strong>
            </div>
            <span className={styles.badge}>{onTrack ? 'No orçamento' : 'Acima do orçamento'}</span>
          </div>
          <div className={styles.progress}><div style={{ width: `${Math.round(elapsed * 100)}%` }} /></div>
          <div className={styles.footRow}>
            <span>Limite seguro: {formatBRL(burn)} / dia</span>
            <span className={styles.accent}>{Math.round(elapsed * 100)}% do mês decorridos</span>
          </div>
        </section>
      )}

      <section className={styles.quote}>
        <Lightbulb size={16} />
        <div>
          <p>“{QUOTES[dayOfYear() % QUOTES.length]}”</p>
          <small>Resumo · Dia {dayOfYear()}</small>
        </div>
      </section>
    </>
  )
}

export default function HomePage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'feed' ? 'feed' : 'home'

  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="tablist">
        {(['home', 'feed'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? styles.tabOn : styles.tab}
            onClick={() => setParams(t === 'home' ? {} : { tab: t }, { replace: true })}
          >
            {t === 'home' ? 'Início' : 'Feed'}
          </button>
        ))}
      </div>
      {tab === 'feed' ? <SocialFeed /> : <Overview />}
    </div>
  )
}
