import ChoiceField from '../../components/ui/ChoiceField'
import { useState } from 'react'
import { Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, MoreVertical, PlusCircle, TrendingUp, Zap, Check } from 'lucide-react'
import { addDays, localDateStr, startOfDay, startOfWeek } from '../../lib/date'
import {
  CATEGORIES, byTime, currentStreak, dayLevel, isDone, isScheduled, nextRun, rangeStats, rowSub,
  type Habit, type Index,
} from '../../features/habits/stats'
import { useCreateHabit, useToggleLog } from '../../features/habits/queries'
import { HABIT_ICONS } from '../../features/onboarding/habitIcons'
import { DAYS } from '../../features/onboarding/habitPresets'
import { ViewSwitch, type View } from './common'
import { heatClass } from './heat'
import styles from './habits.module.css'

interface Props {
  habits: Habit[]
  ix: Index
  view: View
  setView: (v: View) => void
  onEdit: (h: Habit) => void
}

const iconOf = (h: Habit) => HABIT_ICONS[h.icon ?? 'custom'] ?? HABIT_ICONS.custom
const dayList = (h: Habit) => DAYS.filter((d) => h.weekdays.includes(d.v)).map((d) => d.label).join(', ')

export default function MonthlyView({ habits, ix, view, setView, onEdit }: Props) {
  const toggle = useToggleLog()
  const create = useCreateHabit()
  const today = startOfDay()
  const todayStr = localDateStr(today)

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [showDone, setShowDone] = useState(true)
  const [name, setName] = useState('')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [time, setTime] = useState('08:00')
  const [category, setCategory] = useState('mindfulness')

  const last30 = rangeStats(habits, ix, addDays(today, -29), today)
  const prev30 = rangeStats(habits, ix, addDays(today, -59), addDays(today, -30))
  const delta = prev30.scheduled > 0 ? last30.pct - prev30.pct : null

  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
  const isCurrentMonth = cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth()
  const month = rangeStats(habits, ix, cursor, monthEnd < today ? monthEnd : today)

  const cells: Date[] = []
  for (let d = startOfWeek(cursor); d <= monthEnd || cells.length % 7 !== 0; d = addDays(d, 1)) cells.push(d)

  const scheduled = habits.filter((h) => isScheduled(h, today))
  const pending = scheduled.filter((h) => !isDone(ix, h.id, todayStr)).sort(byTime)
  const finished = scheduled.filter((h) => isDone(ix, h.id, todayStr))
  const rest = habits.filter((h) => !isScheduled(h, today))

  function toggleDay(v: number) {
    setDays((cur) => {
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
      return next.length ? next : cur
    })
  }

  function ignite() {
    create.mutate({ name: name.trim(), weekdays: days, time, category }, { onSuccess: () => setName('') })
  }

  return (
    <>
      <div className={styles.topRow}>
        <span className={styles.kicker}>MATRIZ DE HÁBITOS</span>
        <span className={styles.syncPill}><i /> Sinapses sincronizadas</span>
      </div>
      <div className={styles.titleRow}>
        <h1 className={styles.h1}>Hábitos diários</h1>
        <span className={styles.todayLabel}>Hoje, {today.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}</span>
      </div>
      <div className={styles.pillRow}>
        <span className={styles.pillBox}><CheckCircle2 size={13} /> {last30.pct}% de consistência</span>
        {delta !== null && (
          <span className={styles.delta}><TrendingUp size={12} /> {delta >= 0 ? '+' : ''}{delta}% vs. mês passado</span>
        )}
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <ViewSwitch view={view} onChange={setView} />
          <div className={styles.monthNav}>
            <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}             aria-label="Mês anterior"><ChevronLeft size={16} /></button>
            <strong>{cursor.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</strong>
            <button type="button" disabled={isCurrentMonth} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}             aria-label="Próximo mês"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className={styles.adherence}>
          <div>
            <span className={styles.cap}>ADERÊNCIA À META</span>
            <strong>{month.pct}% de sucesso</strong>
          </div>
          <span className={styles.iconBox}><Zap size={16} /></span>
        </div>

        <div className={styles.calHead}>{['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((l, i) => <span key={i}>{l}</span>)}</div>
        <div className={styles.calGrid}>
          {cells.map((d) => {
            const inMonth = d.getMonth() === cursor.getMonth()
            const ds = localDateStr(d)
            const lv = inMonth && d <= today ? dayLevel(habits, ix, d) : -1
            return (
              <span key={ds} className={`${styles.day} ${inMonth ? heatClass(lv) : styles.lvOut}`}>
                {d.getDate()}
                {ds === todayStr && <i className={styles.todayDot} />}
              </span>
            )
          })}
        </div>
        <div className={styles.legend}>
          <b>Escala de intensidade</b>
          <span>Menos</span>
          {[1, 2, 3, 4].map((n) => <i key={n} className={`${styles.sw} ${heatClass(n)}`} />)}
          <span>Máximo</span>
        </div>
      </section>

      <div className={styles.sectionHead}>
        <span><Calendar size={14} /> Programados para hoje</span>
        <em className={styles.badge}>{pending.length} pendentes</em>
      </div>
      <ul className={styles.rows}>
        {pending.map((h) => {
          const Icon = iconOf(h)
          return (
            <li key={h.id} className={styles.row}>
              <span className={styles.iconBox}><Icon size={16} /></span>
              <div className={styles.rowText}><strong>{h.name}</strong><small>{rowSub(h, currentStreak(h, ix, today))}</small></div>
              <button type="button" className={styles.kebab} onClick={() => onEdit(h)}               aria-label={`Editar ${h.name}`}><MoreVertical size={16} /></button>
              <button type="button" className={styles.circle} onClick={() => toggle.mutate({ habitId: h.id, date: todayStr, done: false })}               aria-label={`Concluir ${h.name}`} />
            </li>
          )
        })}
        {pending.length === 0 && (
          <li className={styles.empty}>{scheduled.length ? 'Todos os hábitos concluídos hoje.' : 'Nenhum hábito programado hoje.'}</li>
        )}
      </ul>

      {finished.length > 0 && (
        <>
          <button type="button" className={styles.sectionHeadBtn} onClick={() => setShowDone((v) => !v)}>
            <span><i className={styles.dot} /> Concluídos hoje <em className={styles.badge}>{finished.length} concluídos</em></span>
            <ChevronDown size={16} className={showDone ? '' : styles.rotated} />
          </button>
          {showDone && (
            <ul className={styles.rows}>
              {finished.map((h) => {
                const Icon = iconOf(h)
                return (
                  <li key={h.id} className={`${styles.row} ${styles.rowDone}`}>
                    <span className={styles.iconBox}><Icon size={16} /></span>
                    <div className={styles.rowText}>
                      <strong>{h.name}</strong>
                      <small className={styles.accentSm}>✓ +1 sequência ({ix.byHabit.get(h.id) ?? 0} dias no total)</small>
                    </div>
                    <button type="button" className={styles.kebab} onClick={() => onEdit(h)}                     aria-label={`Editar ${h.name}`}><MoreVertical size={16} /></button>
                    <button type="button" className={styles.doneCheck} onClick={() => toggle.mutate({ habitId: h.id, date: todayStr, done: true })} aria-label={`Desfazer ${h.name}`}><Check size={14} /></button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {rest.length > 0 && (
        <>
          <div className={styles.sectionHead}>
            <span><Calendar size={14} /> Não programados hoje</span>
            <small className={styles.hint}>Descanso / Ciclo alternado</small>
          </div>
          <ul className={styles.rows}>
            {rest.map((h) => {
              const Icon = iconOf(h)
              return (
                <li key={h.id} className={`${styles.row} ${styles.rowDim}`}>
                  <span className={styles.iconBox}><Icon size={16} /></span>
                  <div className={styles.rowText}><strong>{h.name}</strong><small>Agenda: apenas {dayList(h)}</small></div>
                  <span className={styles.nextTag}>{nextRun(h, today)}</span>
                  <button type="button" className={styles.kebab} onClick={() => onEdit(h)} aria-label={`Editar ${h.name}`}><MoreVertical size={16} /></button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <span><PlusCircle size={15} /> Criar novo hábito</span>
          <em className={styles.badge}>Ciclo neural</em>
        </div>
        <span className={styles.cap}>AÇÃO DO HÁBITO</span>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ler por 20 minutos" />
        <div className={styles.rowBetween}>
          <span className={styles.cap}>DIAS ATIVOS</span>
          <button type="button" className={styles.link} onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>Todos os dias</button>
        </div>
        <div className={styles.days}>
          {DAYS.map((d) => (
            <button key={d.v} type="button" className={days.includes(d.v) ? styles.dayOn : styles.dayBtn} onClick={() => toggleDay(d.v)} aria-pressed={days.includes(d.v)} aria-label={d.label}>
              {d.letter}
            </button>
          ))}
        </div>
        <div className={styles.twoCols}>
          <label className={styles.field}><Clock size={14} /><input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} /></label>
          <ChoiceField label="Categoria do hábito" value={category} onChange={setCategory}
              options={CATEGORIES.map(({ id, label }) => ({ value: id, label }))} />
        </div>
        <button type="button" className={styles.primary} onClick={ignite} disabled={!name.trim() || create.isPending}>
          <Zap size={14} /> Ativar hábito
        </button>
      </section>
    </>
  )
}