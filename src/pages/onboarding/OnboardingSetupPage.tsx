import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, CheckCircle2, Flame, Flower2, Maximize2, Plus, Shield, SlidersHorizontal, Sparkles, Target, Wallet } from 'lucide-react'
import { useOnboarding } from '../../features/onboarding/useOnboarding'
import { PRESETS, customDraft, toDraft } from '../../features/onboarding/habitPresets'
import { HABIT_ICONS } from '../../features/onboarding/habitIcons'
import { formatBRL } from '../../features/onboarding/utils'
import type { Experience, TrainingGoal } from '../../features/onboarding/types'
import MoneyInput from './MoneyInput'
import styles from './onboarding.module.css'

const GOALS: { id: TrainingGoal; label: string; icon: typeof Target }[] = [
  { id: 'muscle_gain', label: 'Muscle Gain', icon: Target },
  { id: 'fat_loss', label: 'Fat Loss', icon: Flame },
  { id: 'strength', label: 'Raw Strength', icon: Shield },
  { id: 'longevity', label: 'Longevity & Mobility', icon: Flower2 },
]
const LEVELS: { id: Experience; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
]
const FREQUENCIES = [3, 4, 5, 6]
const SPLITS: Record<number, string> = { 3: 'Full Body', 4: 'Upper / Lower', 5: 'Push / Pull / Legs+', 6: 'Push / Pull / Legs' }
const MAX_HABITS = 5

export default function OnboardingSetupPage() {
  const { data, setData } = useOnboarding()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [custom, setCustom] = useState('')

  const finance = data.modules.includes('finance')
  const workouts = data.modules.includes('workouts')
  const engines = 1 + Number(finance) + Number(workouts)
  const hasAuto = ['tasks', 'calendar', 'assistant'].some((m) => data.modules.includes(m))
  const savings = Math.round(data.monthlyIncome * data.savingsPct) / 100
  const tier = LEVELS.findIndex((l) => l.id === data.experience) + 1

  const customHabits = data.habits.filter((h) => !PRESETS.some((p) => p.key === h.key))
  const rows = [...PRESETS.map((p) => ({ key: p.key, name: p.name, subtitle: p.subtitle, icon: p.icon })),
    ...customHabits.map((h) => ({ key: h.key, name: h.name, subtitle: h.subtitle, icon: h.icon }))]

  function toggleHabit(key: string) {
    setData((d) => {
      if (d.habits.some((h) => h.key === key)) return { ...d, habits: d.habits.filter((h) => h.key !== key) }
      const preset = PRESETS.find((p) => p.key === key)
      if (!preset || d.habits.length >= MAX_HABITS) return d
      return { ...d, habits: [...d.habits, toDraft(preset)] }
    })
  }

  function addCustom() {
    const name = custom.trim()
    if (!name) return
    setData((d) => (d.habits.length >= MAX_HABITS ? d : { ...d, habits: [...d.habits, customDraft(name)] }))
    setCustom('')
    setAdding(false)
  }

  return (
    <>
      <span className={styles.tag}><Sparkles size={12} /> TAILORED CONFIGURATION</span>
      <h1 className={styles.h1}>Configure Your Engines</h1>
      <p className={styles.lead}>Fine-tune the parameters for your chosen modules. Only active engines require baseline inputs.</p>

      <section className={styles.loadCard}>
        <span className={styles.iconBox}><SlidersHorizontal size={18} /></span>
        <div className={styles.loadText}>
          <span className={styles.cap}>ACTIVE SETUP LOAD</span>
          <strong>{engines} Primary Engines</strong>
        </div>
        <span className={styles.badge}>Est. 2 min</span>
      </section>

      {finance && (
        <section className={styles.section}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Wallet size={18} /></span>
            <div className={styles.cardTitle}><strong>Finance &amp; Capital</strong><small>Monthly Cashflow Baseline</small></div>
            <span className={styles.badge}>R$ BRL</span>
          </div>
          <div className={styles.rowBetween}><span className={styles.label}>Net Monthly Income</span><span className={styles.hint}>Take-home post tax</span></div>
          <MoneyInput value={data.monthlyIncome} onChange={(n) => setData((d) => ({ ...d, monthlyIncome: n }))} />
          <div className={styles.inner}>
            <div className={styles.rowBetween}>
              <span className={styles.hint}>Monthly Savings Target</span>
              <span className={styles.accent}>{formatBRL(savings)} ({data.savingsPct}%)</span>
            </div>
            <p className={styles.hint}>Autonomous allocation toward Emergency Fund &amp; Index Funds</p>
            <input
              type="range" min={5} max={60} step={1} value={data.savingsPct} className={styles.range}
              onChange={(e) => setData((d) => ({ ...d, savingsPct: Number(e.target.value) }))}
              aria-label="Savings percentage"
            />
            <div className={styles.rowBetween}>
              {[{ l: 'Safe (10%)', v: 10 }, { l: 'Optimal (25%)', v: 25 }, { l: 'Aggressive (50%)', v: 50 }].map((p) => (
                <button key={p.v} type="button" className={`${styles.presetBtn} ${data.savingsPct === p.v ? styles.presetOn : ''}`} onClick={() => setData((d) => ({ ...d, savingsPct: p.v }))}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {workouts && (
        <section className={styles.section}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Maximize2 size={18} /></span>
            <div className={styles.cardTitle}><strong>Workouts &amp; Hypertrophy</strong><small>Training Protocol &amp; Volume</small></div>
            <span className={styles.badge}>Engine 02</span>
          </div>
          <span className={styles.label}>Primary Training Focus</span>
          <div className={styles.grid2}>
            {GOALS.map(({ id, label, icon: Icon }) => {
              const on = data.trainingGoal === id
              return (
                <button key={id} type="button" className={`${styles.goalBtn} ${on ? styles.goalOn : ''}`} onClick={() => setData((d) => ({ ...d, trainingGoal: id }))}>
                  <span>{label}</span>
                  {on ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </button>
              )
            })}
          </div>
          <div className={styles.inner}>
            <div className={styles.rowBetween}><span className={styles.hint}>Experience Level</span><span className={styles.accentSm}>Hypertrophy Tier {tier}</span></div>
            <div className={styles.segmented}>
              {LEVELS.map((l) => (
                <button key={l.id} type="button" className={data.experience === l.id ? styles.segOn : styles.seg} onClick={() => setData((d) => ({ ...d, experience: l.id }))}>{l.label}</button>
              ))}
            </div>
            <div className={styles.rowBetween}><span className={styles.hint}>Weekly Frequency</span><span className={styles.accentSm}>{SPLITS[data.weeklyFrequency]}</span></div>
            <div className={styles.segmented}>
              {FREQUENCIES.map((f) => (
                <button key={f} type="button" className={data.weeklyFrequency === f ? styles.segOn : styles.seg} onClick={() => setData((d) => ({ ...d, weeklyFrequency: f }))}>
                  {data.weeklyFrequency === f ? `${f}d / wk` : `${f}d`}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.cardHead}>
          <span className={styles.iconBox}><Flame size={18} /></span>
          <div className={styles.cardTitle}><strong>Habits &amp; Consistency</strong><small>Starter Loops (Pick up to {MAX_HABITS})</small></div>
          <span className={styles.badge}>{data.habits.length}/{MAX_HABITS} selected</span>
        </div>
        <p className={styles.hint}>Prime your neural reward loop with high-momentum routines configured for Day 1.</p>
        <ul className={styles.list}>
          {rows.map((r) => {
            const on = data.habits.some((h) => h.key === r.key)
            const Icon = HABIT_ICONS[r.icon] ?? HABIT_ICONS.custom
            return (
              <li key={r.key}>
                <button type="button" className={`${styles.habitRow} ${on ? '' : styles.dim}`} onClick={() => toggleHabit(r.key)} aria-pressed={on}>
                  <Icon size={16} className={styles.rowIcon} />
                  <span className={styles.moduleText}><strong>{r.name}</strong><small>{r.subtitle}</small></span>
                  <span className={`${styles.check} ${on ? styles.checkOn : ''}`}>{on && <Check size={14} />}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {adding ? (
          <div className={styles.row}>
            <input className={styles.input} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Habit name" autoFocus />
            <button type="button" className={styles.smallBtn} onClick={addCustom}>Add</button>
          </div>
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setAdding(true)} disabled={data.habits.length >= MAX_HABITS}>
            <Plus size={14} /> Add custom habit
          </button>
        )}
      </section>

      {hasAuto && (
        <section className={styles.infoBox}>
          <Sparkles size={16} />
          <div>
            <strong>Zero-Friction Autonomous Modules</strong>
            <p>Tasks, Calendar &amp; AI Assistant are configured automatically with calibrated defaults. You can fine-tune them anytime in System Settings.</p>
          </div>
        </section>
      )}

      <button type="button" className={styles.primary} onClick={() => navigate('/onboarding/habits')}>
        Continue to Habit Loop <ArrowRight size={16} />
      </button>
      <button type="button" className={styles.ghost} onClick={() => navigate('/onboarding/modules')}>Back to Module Selection</button>
    </>
  )
}