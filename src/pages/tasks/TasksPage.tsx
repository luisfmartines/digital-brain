import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlignLeft, Bell, Calendar, Check, CheckCircle2, ChevronDown, Clock, MoreVertical, Zap } from 'lucide-react'
import FloatingAction from '../../components/ui/FloatingAction'
import { useDeleteTask, useTasks, useToggleTask, type Task } from '../../features/tasks/queries'
import { TASK_CATEGORIES, type TaskCategory } from '../../../supabase/functions/_shared/planningCategories'
import styles from './Tasks.module.css'

type Filter = 'all' | 'high' | TaskCategory

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'high', label: '● Alta prioridade' },
  ...(Object.keys(TASK_CATEGORIES) as TaskCategory[]).map((id) => ({ id, label: TASK_CATEGORIES[id] })),
]

const matches = (t: Task, f: Filter) => f === 'all' || (f === 'high' ? t.priority === 'high' : t.category === f)

function timeLabel(iso: string | null) {
  if (!iso) return 'Sem horário'
  const d = new Date(iso)
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === new Date().toDateString()) return time
  return `${d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })} · ${time}`
}

function detail(t: Task) {
  const parts: string[] = []
  if (t.remind_minutes_before && t.due_at) {
    const r = new Date(new Date(t.due_at).getTime() - t.remind_minutes_before * 60000)
    parts.push(`Alarme definido para ${r.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
  }
  const note = t.notes?.split('\n')[0]
  if (note) parts.push(note)
  return parts.join(' · ')
}

interface CardProps {
  task: Task
  done?: boolean
  menuOpen: boolean
  onMenu: () => void
  onToggle: () => void
  onDelete: () => void
}

function TaskCard({ task, done, menuOpen, onMenu, onToggle, onDelete }: CardProps) {
  const text = detail(task)
  return (
    <li className={`${styles.card} ${done ? styles.cardDone : ''}`}>
      <button type="button" className={`${styles.box} ${done ? styles.boxOn : ''}`} onClick={onToggle} aria-label={done ? 'Marcar como pendente' : 'Marcar como concluída'}>
        {done && <Check size={14} />}
      </button>
      <div className={styles.body}>
        <div className={styles.metaRow}>
          <span className={styles.time}><Clock size={11} /> {timeLabel(task.due_at)}</span>
          {!done && task.priority === 'high' && <span className={styles.high}>● Alta prioridade</span>}
          {task.category && (
            <span className={task.category === 'fitness' ? styles.chipFit : styles.chip}>{TASK_CATEGORIES[task.category]}</span>
          )}
          {done && <span className={styles.doneTag}>✓ Concluída</span>}
        </div>
        <strong className={styles.title}>{task.title}</strong>
        {!done && text && (
          <span className={styles.detail}>
            {task.remind_minutes_before ? <Bell size={12} /> : <AlignLeft size={12} />} {text}
          </span>
        )}
      </div>
      <div className={styles.menuWrap}>
        <button type="button" className={styles.kebab} onClick={onMenu} aria-label="Opções da tarefa"><MoreVertical size={16} /></button>
        {menuOpen && (
          <div className={styles.menu}>
            <Link to={`/tasks/${task.id}/edit`}>Editar</Link>
            <button type="button" onClick={onDelete}>Excluir</button>
          </div>
        )}
      </div>
    </li>
  )
}

export default function TasksPage() {
  const { data } = useTasks()
  const toggle = useToggleTask()
  const remove = useDeleteTask()
  const [filter, setFilter] = useState<Filter>('all')
  const [showDone, setShowDone] = useState(true)
  const [menuId, setMenuId] = useState<string | null>(null)

  const pending = data?.pending ?? []
  const done = data?.done ?? []
  const all = [...pending, ...done]
  const pct = all.length ? Math.round((done.length / all.length) * 100) : 0
  const shownPending = pending.filter((t) => matches(t, filter))
  const shownDone = done.filter((t) => matches(t, filter))
  const dateLabel = new Date().toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }).toUpperCase()
  const message = all.length === 0 ? 'Adicione uma tarefa para começar' : pct >= 67 ? 'Alta clareza mental · Impulso constante' : 'Aquecer · Continue o ciclo'

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <span className={styles.today}><Calendar size={13} /> HOJE, {dateLabel}</span>
        <span className={styles.countPill}><b>●</b> {pending.length} pendentes · {done.length} concluídas</span>
      </div>
      <div className={styles.titleRow}>
        <h1 className={styles.h1}>Tarefas e checklist</h1>
      </div>

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.heroKicker}><CheckCircle2 size={11} /> PRODUTIVIDADE COGNITIVA</span>
          <span className={styles.heroPct}>{pct}%<small>{done.length} de {all.length} concluídas</small></span>
          <span className={styles.heroMsg}>{message}</span>
          <span className={styles.track}><i style={{ width: `${pct}%` }} /></span>
        </div>
        <div className={styles.ringBox}>
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="21" className={styles.ringBg} />
            <circle cx="26" cy="26" r="21" className={styles.ringFg} strokeDasharray={`${(pct / 100) * 131.95} 131.95`} transform="rotate(-90 26 26)" />
          </svg>
          <span className={styles.ringIcon}><Zap size={18} /></span>
        </div>
      </section>

      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={filter === f.id ? styles.filterOn : styles.filter} onClick={() => setFilter(f.id)}>
            {f.label} ({all.filter((t) => matches(t, f.id)).length})
          </button>
        ))}
      </div>

      {shownPending.length === 0 && shownDone.length === 0 && (
        <p className={styles.empty}>{all.length === 0 ? 'Nenhuma tarefa ainda.' : 'Nenhuma tarefa neste filtro.'}</p>
      )}

      <ul className={styles.list}>
        {shownPending.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            menuOpen={menuId === t.id}
            onMenu={() => setMenuId(menuId === t.id ? null : t.id)}
            onToggle={() => toggle.mutate({ id: t.id, done: false })}
            onDelete={() => { setMenuId(null); remove.mutate(t.id) }}
          />
        ))}
      </ul>

      {shownDone.length > 0 && (
        <>
          <button type="button" className={styles.doneHead} onClick={() => setShowDone((v) => !v)}>
            <span><CheckCircle2 size={15} /> Concluídas <i className={styles.count}>{shownDone.length}</i></span>
            <ChevronDown size={16} className={showDone ? '' : styles.rotated} />
          </button>
          {showDone && (
            <ul className={styles.list}>
              {shownDone.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  done
                  menuOpen={menuId === t.id}
                  onMenu={() => setMenuId(menuId === t.id ? null : t.id)}
                  onToggle={() => toggle.mutate({ id: t.id, done: true })}
                  onDelete={() => { setMenuId(null); remove.mutate(t.id) }}
                />
              ))}
            </ul>
          )}
        </>
      )}
      <FloatingAction to="/tasks/new" label="Nova tarefa" />
    </div>
  )
}
