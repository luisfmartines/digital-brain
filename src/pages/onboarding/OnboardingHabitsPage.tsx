import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Circle, Clock, Link2, Plus, Shield, Star, TrendingUp, Zap, Armchair } from 'lucide-react'
import Toggle from '../../components/ui/Toggle'
import { useOnboarding } from '../../features/onboarding/useOnboarding'
import { DAYS, customDraft } from '../../features/onboarding/habitPresets'
import { HABIT_ICONS } from '../../features/onboarding/habitIcons'
import { fmtTime, weekdaysLabel } from '../../features/onboarding/utils'
import type { HabitDraft } from '../../features/onboarding/types'
import styles from './onboarding.module.css'

const MAX_HABITS = 5

export default function OnboardingHabitsPage() {
  const { data, setData } = useOnboarding()
  const navigate = useNavigate()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const activeCount = data.habits.filter((h) => h.active).length

  const patch = (key: string, p: Partial<HabitDraft>) =>
    setData((d) => ({ ...d, habits: d.habits.map((h) => (h.key === key ? { ...h, ...p } : h)) }))

  function toggleDay(h: HabitDraft, v: number) {
    const next = h.weekdays.includes(v) ? h.weekdays.filter((x) => x !== v) : [...h.weekdays, v]
    if (next.length > 0) patch(h.key, { weekdays: next })
  }

  function remove(key: string) {
    setData((d) => ({ ...d, habits: d.habits.filter((h) => h.key !== key) }))
    setOpenKey(null)
  }

  function addCustom() {
    const name = newName.trim()
    if (!name) return
    const draft = customDraft(name)
    setData((d) => (d.habits.length >= MAX_HABITS ? d : { ...d, habits: [...d.habits, draft] }))
    setOpenKey(draft.key)
    setNewName('')
    setAdding(false)
  }

  // Previsão de XP da semana
  const plan = DAYS.map((d) => {
    const scheduled = data.habits.some((h) => h.active && h.weekdays.includes(d.v))
    const weekend = d.v === 0 || d.v === 6
    if (!scheduled) return { ...d, xp: 0, kind: 'off' as const }
    if (weekend && data.weekendElasticity) return { ...d, xp: 15, kind: 'mvh' as const }
    return { ...d, xp: 30, kind: 'full' as const }
  })
  const total = plan.reduce((sum, d) => sum + d.xp, 0)

  return (
    <>
      <span className={styles.tag}><Zap size={12} /> NEURAL HABIT LOOPS</span>
      <h1 className={styles.h1}>Engineer Your Daily Momentum</h1>
      <p className={styles.lead}>Habits stick when tied to existing triggers. Configure your core identity habits, anchor cues, and streak protections.</p>

      <div className={styles.rowBetween}>
        <span className={styles.sectionLabel}>Configured Identity Loops <span className={styles.badge}>{activeCount} Active</span></span>
        <span className={styles.hint}>Tap card to edit cue</span>
      </div>

      <ul className={styles.list}>
        {data.habits.map((h) => {
          const Icon = HABIT_ICONS[h.icon] ?? HABIT_ICONS.custom
          const open = openKey === h.key
          return (
            <li key={h.key} className={styles.loopCard}>
              <div className={styles.loopHead}>
                <span className={styles.iconBox}><Icon size={18} /></span>
                <div className={styles.cardTitle}>
                  <strong>{h.name} <em className={styles.badge}>{h.tag}</em></strong>
                  <small>{h.loopSubtitle}</small>
                </div>
                <Toggle checked={h.active} onChange={(v) => patch(h.key, { active: v })} label={`Activate ${h.name}`} />
              </div>
              <button type="button" className={styles.loopBody} onClick={() => setOpenKey(open ? null : h.key)} aria-expanded={open}>
                <span className={styles.strip}>
                  <Link2 size={12} /> <span className={styles.cap}>ANCHOR CUE</span>
                  <b>{h.anchorCue || 'Tap to set a cue'}</b>
                </span>
                <span className={styles.strip}>
                  <Clock size={12} /> {fmtTime(h.time)} · {weekdaysLabel(h.weekdays)}
                  <span className={styles.primed}>{h.active ? '● Loop Primed' : 'Paused'}</span>
                </span>
              </button>
              {open && (
                <div className={styles.editor}>
                  <label className={styles.fieldLabel}>
                    Anchor cue
                    <input className={styles.input} value={h.anchorCue} onChange={(e) => patch(h.key, { anchorCue: e.target.value })} placeholder="When will you do this?" />
                  </label>
                  <label className={styles.fieldLabel}>
                    Time
                    <input className={styles.input} type="time" value={h.time} onChange={(e) => e.target.value && patch(h.key, { time: e.target.value })} />
                  </label>
                  <span className={styles.fieldLabel}>Days of the week</span>
                  <div className={styles.days}>
                    {DAYS.map((d) => (
                      <button key={d.v} type="button" className={h.weekdays.includes(d.v) ? styles.dayOn : styles.day} onClick={() => toggleDay(h, d.v)} aria-label={d.label}>
                        {d.letter}
                      </button>
                    ))}
                  </div>
                  <button type="button" className={styles.removeBtn} onClick={() => remove(h.key)}>Remove loop</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {adding ? (
        <div className={styles.row}>
          <input className={styles.input} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Habit name" autoFocus />
          <button type="button" className={styles.smallBtn} onClick={addCustom}>Add</button>
        </div>
      ) : (
        data.habits.length < MAX_HABITS && (
          <button type="button" className={styles.addLoop} onClick={() => setAdding(true)}>
            <Plus size={14} /> Add Another Identity Loop
          </button>
        )
      )}

      <span className={styles.sectionLabel}><i className={styles.dot} /> Bio-Adaptive Streak Shield</span>
      <ul className={styles.shield}>
        <li>
          <span className={styles.iconBox}><Shield size={16} /></span>
          <div className={styles.cardTitle}>
            <strong>Streak Freeze Window <em className={styles.badge}>PROTECTED</em></strong>
            <small>Allows 1 rest or sickness day per 14-day cycle without breaking your continuous momentum tally</small>
          </div>
          <span className={styles.badge}>1 Grace / 14d</span>
        </li>
        <li>
          <span className={styles.iconBox}><Zap size={16} /></span>
          <div className={styles.cardTitle}>
            <strong>MVH Protocol <em className={styles.muted}>Atomic</em></strong>
            <small>On exhausted days, 2 minutes meditation or 2 pages keeps the neural connection firing.</small>
          </div>
          <button type="button" className={`${styles.check} ${data.mvhProtocol ? styles.checkOn : ''}`} onClick={() => setData((d) => ({ ...d, mvhProtocol: !d.mvhProtocol }))} aria-pressed={data.mvhProtocol} aria-label="MVH Protocol">
            {data.mvhProtocol && <Check size={14} />}
          </button>
        </li>
        <li>
          <span className={styles.iconBox}><Armchair size={16} /></span>
          <div className={styles.cardTitle}>
            <strong>Weekend Elasticity</strong>
            <small>Relaxed volume targets on Sat &amp; Sun</small>
          </div>
          <Toggle checked={data.weekendElasticity} onChange={(v) => setData((d) => ({ ...d, weekendElasticity: v }))} label="Weekend Elasticity" />
        </li>
      </ul>

      <section className={styles.forecast}>
        <div className={styles.rowBetween}>
          <div>
            <span className={styles.cap}>WEEK 1 TRAJECTORY FORECAST</span>
            <div className={styles.forecastXp}>+{total} XP <small>/ projected weekly</small></div>
          </div>
          <span className={styles.iconBox}><TrendingUp size={16} /></span>
        </div>
        <div className={styles.week}>
          {plan.map((d) => (
            <div key={d.v} className={styles.weekCol}>
              <span className={styles.cap}>{d.label}</span>
              <span className={d.kind === 'full' ? styles.tileOn : styles.tile}>
                {d.kind === 'full' && <Check size={14} />}
                {d.kind === 'mvh' && <Circle size={14} />}
                {d.kind === 'off' && <Star size={14} />}
              </span>
              <span className={styles.tileXp}>{d.kind === 'mvh' ? 'MVH' : d.kind === 'full' ? '+30' : '–'}</span>
            </div>
          ))}
        </div>
        <p className={styles.quote}>“Consistent micro-actions compound into an unstoppable cognitive system.”</p>
      </section>

      <button type="button" className={styles.primary} onClick={() => navigate('/onboarding/ready')}>
        Continue to Final Review <ArrowRight size={16} />
      </button>
      <button type="button" className={styles.ghost} onClick={() => navigate('/onboarding/setup')}>
        <ArrowLeft size={14} /> Back to Module Parameters
      </button>
    </>
  )
}