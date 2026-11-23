import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, ArrowUp, Banknote, Check, CheckCircle2, ChevronRight, Clock, Droplet, Flame, Lightbulb, Maximize2, Play, Sparkles, Trophy, TrendingUp, Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useProfile } from '../../features/profile/useProfile'
import {
  useMonthFinance, useTasksSummary, useTodayHabits, useToggleHabit, useWorkoutsToday,
} from '../../features/home/queries'
import { WATER_STEP, litersLabel, useAddWater, useWater } from '../../features/water/queries'
import { levelInfo } from '../../features/profile/level'
import FeedView from '../workouts/FeedView'
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
  const [prompt, setPrompt] = useState('')

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
  if (has('workouts')) rows.push({ key: 'workout', icon: Maximize2, label: 'Treino', text: `${Math.min(workoutsToday, 1)}/1 treino`, ratio: Math.min(workoutsToday, 1), counts: true })
  const lv = levelInfo(profile?.xp, profile?.level)
  const counted = rows.filter((r) => r.counts)
  const overall = counted.length ? Math.round((counted.reduce((a, r) => a + Math.min(1, r.ratio), 0) / counted.length) * 100) : 0

  // Rotina "pronta hoje": a que você treinou há mais tempo
  const ready = [...routines].sort((a, b) => (last[a.id] ?? '').localeCompare(last[b.id] ?? ''))[0]
  const readyMuscles = ready ? [...new Set(ready.routine_exercises.map((x) => muscleLabel(x.exercise.muscle_group)))].slice(0, 2).join(' & ') : ''

  function goAssistant(text: string) {
    navigate('/assistant', { state: { prompt: text } })
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (prompt.trim()) goAssistant(prompt.trim())
  }
  function startReady() {
    if (!ready) return navigate('/workouts/routines/new')
    startWorkout.mutate(ready, { onSuccess: (id) => navigate(`/workouts/active/${id}`) })
  }

  return (
    <>
      <div className={styles.topRow}>
        <span className={styles.pill}>
          <i className={online ? styles.dot : styles.dotOff} />
          {online ? 'SINCRONIZAÇÃO NEURAL ÓTIMA · 100%' : 'OFFLINE · SINCRONIZAÇÃO PENDENTE'}
        </span>
        <span className={styles.date}>{dateLabel}</span>
      </div>

      <h1 className={styles.hello}>Olá, <span>{firstName}</span></h1>
      <p className={styles.sub}>Sua mente está clara. {today} {today === 1 ? 'prioridade' : 'prioridades'} agendada(s) hoje.</p>

      <section className={styles.hero}>
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
        <div className={styles.heroPct}>
          <strong>{overall}%</strong>
          <small>concluído hoje</small>
        </div>
      </section>

      <section className={styles.level} aria-label="Nível">
        <span className={styles.levelBadge}><Trophy size={14} /><b>LVL {lv.level}</b></span>
        <div className={styles.levelBody}>
          <div className={styles.levelTop}>
            <strong>{lv.rank}</strong>
            <span>{lv.xp.toLocaleString('pt-BR')} XP</span>
          </div>
          <span className={styles.levelBar}><i style={{ width: `${lv.pct}%` }} /></span>
          <small>{lv.toNext.toLocaleString('pt-BR')} XP para o nível {lv.level + 1}</small>
        </div>
      </section>

      {has('assistant') && (
        <>
          <form className={styles.command} onSubmit={submit}>
            <Sparkles size={18} className={styles.cmdIcon} />
            <input className={styles.cmdInput} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Pergunte ao Digital Brain ou registre uma tarefa..." />
            <button type="submit" className={styles.send} aria-label="Enviar"><ArrowUp size={18} /></button>
          </form>
          <div className={styles.chips}>
            <button type="button" className={styles.chip} onClick={() => goAssistant('Reunião com o Produto às 15h')}><CheckCircle2 size={14} /> Reunião às 15h</button>
            <button type="button" className={styles.chip} onClick={() => goAssistant('Gastei R$ 50 no McDonald’s')}><Banknote size={14} /> Gastei R$ 50 no McDonald’s</button>
            <button type="button" className={styles.chip} onClick={() => addWater.mutate(500)}><Droplet size={14} /> Registrar 500 ml de água</button>
          </div>
        </>
      )}

      <div className={styles.sectionRow}>
        <span className={styles.label}>SINAPSES ATIVAS</span>
        <span className={styles.live}>Visão geral ao vivo</span>
      </div>

      {has('tasks') && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><CheckCircle2 size={18} /></span>
            <div className={styles.titleBox}>
              <span className={styles.cap}>A SEGUIR · PRIORIDADE</span>
              <strong>{tasks.data?.next?.title ?? 'Nenhuma tarefa ainda'}</strong>
            </div>
            <span className={styles.badge}>{tasks.data?.pending ?? 0} pendentes</span>
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
              <span className={styles.cap}>CICLO DE HÁBITOS</span>
              <strong>{streak > 0 ? `Sequência ativa de ${streak} dias` : 'Comece sua sequência hoje'}</strong>
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
            <span className={styles.iconBox}><Maximize2 size={18} /></span>
            <div className={styles.titleBox}>
              <span className={styles.cap}>MOTOR FÍSICO</span>
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
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Wallet size={18} /></span>
            <div className={styles.titleBox}>
              <span className={styles.cap}>MARGEM DE CAPITAL</span>
              <strong>{formatBRL(margin)}</strong>
            </div>
            <span className={styles.badge}><TrendingUp size={10} /> {onTrack ? 'No orçamento' : 'Acima do orçamento'}</span>
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
          <small>Resumo do Digital Brain · Dia {dayOfYear()}</small>
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
      {tab === 'feed' ? <FeedView /> : <Overview />}
    </div>
  )
}