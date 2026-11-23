import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Flame, Plus, SlidersHorizontal, Sparkles, Wallet } from 'lucide-react'
import { useOnboarding } from '../../features/onboarding/useOnboarding'
import { PRESETS, customDraft, toDraft } from '../../features/onboarding/habitPresets'
import { HABIT_ICONS } from '../../features/onboarding/habitIcons'
import { formatBRL } from '../../features/onboarding/utils'
import MoneyInput from './MoneyInput'
import styles from './onboarding.module.css'

const MAX_HABITS = 5

export default function OnboardingSetupPage() {
  const { data, setData } = useOnboarding()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [custom, setCustom] = useState('')

  const finance = data.modules.includes('finance')
  const engines = 1 + Number(finance)
  const hasAuto = ['tasks', 'calendar', 'assistant'].some((m) => data.modules.includes(m))
  const savings = Math.round(data.monthlyIncome * data.savingsPct) / 100

  const customHabits = data.habits.filter((h) => !PRESETS.some((p) => p.key === h.key))
  const rows = [
    ...PRESETS.map((p) => ({ key: p.key, name: p.name, subtitle: p.subtitle, icon: p.icon })),
    ...customHabits.map((h) => ({ key: h.key, name: h.name, subtitle: h.subtitle, icon: h.icon })),
  ]

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
      <span className={styles.tag}><Sparkles size={12} /> CONFIGURAÇÃO PERSONALIZADA</span>
      <h1 className={styles.h1}>Configure seus módulos</h1>
      <p className={styles.lead}>Ajuste os parâmetros dos módulos escolhidos. Apenas os módulos ativos precisam de informações básicas.</p>

      <section className={styles.loadCard}>
        <span className={styles.iconBox}><SlidersHorizontal size={18} /></span>
        <div className={styles.loadText}>
          <span className={styles.cap}>CONFIGURAÇÃO ATIVA</span>
          <strong>{engines} {engines === 1 ? 'módulo principal' : 'módulos principais'}</strong>
        </div>
        <span className={styles.badge}>Cerca de 2 min</span>
      </section>

      {finance && (
        <section className={styles.section}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Wallet size={18} /></span>
            <div className={styles.cardTitle}><strong>Finanças e Capital</strong><small>Base mensal de fluxo de caixa</small></div>
            <span className={styles.badge}>R$ BRL</span>
          </div>
          <div className={styles.rowBetween}><span className={styles.label}>Renda mensal líquida</span><span className={styles.hint}>Após impostos</span></div>
          <MoneyInput value={data.monthlyIncome} onChange={(n) => setData((d) => ({ ...d, monthlyIncome: n }))} />
          <div className={styles.inner}>
            <div className={styles.rowBetween}>
              <span className={styles.hint}>Meta mensal de economia</span>
              <span className={styles.accent}>{formatBRL(savings)} ({data.savingsPct}%)</span>
            </div>
            <p className={styles.hint}>Alocação automática para Reserva de Emergência e investimentos</p>
            <input
              type="range" min={5} max={60} step={1} value={data.savingsPct} className={styles.range}
              onChange={(e) => setData((d) => ({ ...d, savingsPct: Number(e.target.value) }))}
              aria-label="Percentual de economia"
            />
            <div className={styles.rowBetween}>
              {[{ l: 'Seguro (10%)', v: 10 }, { l: 'Ideal (25%)', v: 25 }, { l: 'Ambicioso (50%)', v: 50 }].map((p) => (
                <button key={p.v} type="button" className={`${styles.presetBtn} ${data.savingsPct === p.v ? styles.presetOn : ''}`} onClick={() => setData((d) => ({ ...d, savingsPct: p.v }))}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.cardHead}>
          <span className={styles.iconBox}><Flame size={18} /></span>
          <div className={styles.cardTitle}><strong>Hábitos e Consistência</strong><small>Rotinas iniciais (até {MAX_HABITS})</small></div>
          <span className={styles.badge}>{data.habits.length}/{MAX_HABITS} selecionados</span>
        </div>
        <p className={styles.hint}>Ative seus ciclos de recompensa com rotinas simples para o primeiro dia.</p>
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
            <input className={styles.input} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Nome do hábito" autoFocus />
            <button type="button" className={styles.smallBtn} onClick={addCustom}>Adicionar</button>
          </div>
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setAdding(true)} disabled={data.habits.length >= MAX_HABITS}>
            <Plus size={14} /> Adicionar hábito personalizado
          </button>
        )}
      </section>

      {hasAuto && (
        <section className={styles.infoBox}>
          <Sparkles size={16} />
          <div>
            <strong>Módulos automáticos sem atrito</strong>
            <p>Tarefas, Calendário e Assistente de IA são configurados automaticamente. Você pode ajustá-los depois nas configurações.</p>
          </div>
        </section>
      )}

      <button type="button" className={styles.primary} onClick={() => navigate('/onboarding/habits')}>
        Continuar para os hábitos <ArrowRight size={16} />
      </button>
      <button type="button" className={styles.ghost} onClick={() => navigate('/onboarding/modules')}>Voltar aos módulos</button>
    </>
  )
}