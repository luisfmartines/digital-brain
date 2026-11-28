import { useState } from 'react'
import { Activity, BrainCircuit, CheckCircle2, ChevronLeft, ChevronRight, Download, Flame, LayoutGrid, Lightbulb, Share2, Trophy, Zap } from 'lucide-react'
import { addDays, localDateStr, parseDate, startOfDay, startOfWeek } from '../../lib/date'
import {
  CATEGORIES, activeDays, countLogs, currentStreak, dayLevel, dayStats, longestStreak, rangeStats, weakestSlot,
  type Habit, type Index,
} from '../../features/habits/stats'
import { HABIT_ICONS } from '../../features/onboarding/habitIcons'
import { ViewSwitch, type View } from './common'
import { heatClass } from './heat'
import { useDevice } from '../../expo/device'
import styles from './habits.module.css'

interface Props {
  habits: Habit[]
  ix: Index
  view: View
  setView: (v: View) => void
}

const WEEKDAY_NAMES = ['domingos', 'segundas-feiras', 'terças-feiras', 'quartas-feiras', 'quintas-feiras', 'sextas-feiras', 'sábados']

function Ring({ pct }: { pct: number }) {
  return (
    <span className={styles.ringBox}>
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="16" className={styles.ringBg} />
        <circle cx="20" cy="20" r="16" className={styles.ringFg} strokeDasharray={`${(pct / 100) * 100.53} 100.53`} transform="rotate(-90 20 20)" />
      </svg>
      <b>{pct}%</b>
    </span>
  )
}

export default function YearlyView({ habits, ix, view, setView }: Props) {
  const device = useDevice()
  const today = startOfDay()
  const todayStr = localDateStr(today)
  const [year, setYear] = useState(today.getFullYear())
  const [quarter, setQuarter] = useState(0)
  const [selected, setSelected] = useState(todayStr)

  const isCurrentYear = year === today.getFullYear()
  const currentQ = Math.floor(today.getMonth() / 3) + 1
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  const pFrom = quarter ? new Date(year, (quarter - 1) * 3, 1) : jan1
  const pEnd = quarter ? new Date(year, quarter * 3, 0) : dec31
  const pTo = pEnd < today ? pEnd : today

  const period = rangeStats(habits, ix, pFrom, pTo)
  const active = activeDays(ix, pFrom, pTo)
  const completed = countLogs(ix, pFrom, pTo)

  // Mapa de calor: semanas em colunas, começando na segunda
  const gridStart = startOfWeek(jan1)
  const weeks = Math.ceil(((dec31.getTime() - gridStart.getTime()) / 86400000 + 1) / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))

  const sel = parseDate(selected).getFullYear() === year ? selected : isCurrentYear ? todayStr : localDateStr(dec31)
  const selDate = parseDate(sel)
  const selStats = dayStats(habits, ix, selDate)
  const selRate = selStats.scheduled ? Math.round((selStats.done / selStats.scheduled) * 100) : null
  const selState = selRate === null ? 'Dia de descanso' : selRate === 100 ? 'Estado máximo de foco' : selRate >= 60 ? 'Estado estável' : 'Sinal baixo'
  const selDiff = selRate === null ? null : selRate - period.pct

  const streaks = habits.map((h) => ({ h, longest: longestStreak(h, ix, today), current: currentStreak(h, ix, today) }))
  const bestLongest = [...streaks].sort((a, b) => b.longest - a.longest)[0]
  const bestCurrent = [...streaks].sort((a, b) => b.current - a.current)[0]

  const catRows = CATEGORIES.map((c) => {
    const hs = habits.filter((h) => h.category === c.id)
    return { ...c, st: rangeStats(hs, ix, pFrom, pTo), has: hs.length > 0 }
  }).filter((c) => c.has)

  const fame = habits
    .map((h) => ({ h, st: rangeStats([h], ix, pFrom, pTo) }))
    .filter((x) => x.st.done > 0)
    .sort((a, b) => b.st.done - a.st.done)
    .slice(0, 3)

  // Projeção anual (só no ano corrente)
  const ytd = countLogs(ix, jan1, today)
  const l30 = countLogs(ix, addDays(today, -29), today)
  const p30 = countLogs(ix, addDays(today, -59), addDays(today, -30))
  const velocity = p30 > 0 ? Math.round(((l30 - p30) / p30) * 100) : null
  const daysLeft = Math.round((dec31.getTime() - today.getTime()) / 86400000)
  const projected = Math.round(ytd + (l30 / 30) * daysLeft)
  const weak = weakestSlot(habits, ix, today)

  function exportJson() {
    const from = localDateStr(jan1)
    const to = localDateStr(dec31)
    const logs = ix.logs.filter((l) => l.log_date >= from && l.log_date <= to)
    const json = JSON.stringify({ year, habits, logs }, null, 2)
    if (device) {
      void device.exportJson(year, json).catch((error: unknown) => console.error('Hebbian export failed', error))
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hebbian-habits-${year}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function share() {
    const text = `Meu Hebbian ${year}: ${period.pct}% de consistência, ${active} dias ativos e ${completed} hábitos concluídos.`
    if (device || navigator.share) {
      try {
        if (device) await device.shareText(text)
        else await navigator.share({ title: 'Hebbian', text })
      } catch {
        // compartilhamento cancelado
      }
    } else {
      await navigator.clipboard.writeText(text)
    }
  }

  return (
    <>
      <div className={styles.pillRowSplit}>
        <span className={styles.syncPill}><i /> MATRIZ DE HÁBITOS • REGISTRO ANUAL DE SINAPSES</span>
        <span className={styles.calibrated}><CheckCircle2 size={12} /> Sistema calibrado</span>
      </div>
      <h1 className={styles.h1}>Consistência anual dos hábitos</h1>
      <span className={styles.sub}>Resumo de {year} e impulso ativo</span>
      <div className={styles.pillRow}>
        <span className={styles.pillBox}><Flame size={13} /> {active} dias ativos</span>
        <span className={styles.pillBox}><Activity size={13} /> {period.pct}% de consistência anual</span>
      </div>

      <div className={`${styles.panel} ${styles.periodPanel}`}>
        <ViewSwitch view={view} onChange={setView} />
        <div className={styles.yearNav}>
          <div className={styles.monthNav}>
            <button type="button" onClick={() => setYear(year - 1)} aria-label="Ano anterior"><ChevronLeft size={16} /></button>
            <strong>{year}</strong>
            <button type="button" disabled={isCurrentYear} onClick={() => setYear(year + 1)} aria-label="Próximo ano"><ChevronRight size={16} /></button>
          </div>
          <div className={styles.quarters}>
            {[1, 2, 3, 4].map((q) => (
              <button key={q} type="button" className={quarter === q ? styles.qOn : styles.q} onClick={() => setQuarter(quarter === q ? 0 : q)}>
                T{q}{isCurrentYear && q === currentQ ? ' (atual)' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <span><LayoutGrid size={14} /> Mapa de sinapses</span>
          <em className={styles.badge}>52 SEMANAS</em>
        </div>
        <div className={styles.selCard}>
          <i className={styles.selDot} />
          <div className={styles.rowText}>
            <strong>{selDate.toLocaleDateString('pt-BR', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
            <small className={styles.accentSm}>{ix.byDay.get(sel) ?? 0} hábitos registrados • {selState}</small>
          </div>
          {selDiff !== null && <span className={styles.badge}>{selDiff >= 0 ? '+' : ''}{selDiff}% vs. média</span>}
        </div>
        <div className={styles.heatMonths}>
          {Array.from({ length: 12 }, (_, m) => {
            const col = Math.floor((new Date(year, m, 1).getTime() - gridStart.getTime()) / 86400000 / 7)
            return (
              <span key={m} style={{ left: `${(col / weeks) * 100}%` }}>
                {new Date(year, m, 1).toLocaleDateString('pt-BR', { month: 'short' })}
              </span>
            )
          })}
        </div>
        <div className={styles.heatGrid} style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
          {cells.map((d) => {
            const ds = localDateStr(d)
            if (d.getFullYear() !== year) return <i key={ds} className={styles.lvHide} />
            const lv = d <= today ? dayLevel(habits, ix, d) : -1
            return (
              <button key={ds} type="button" className={`${styles.heatCell} ${heatClass(lv)} ${ds === sel ? styles.heatSel : ''}`} onClick={() => setSelected(ds)} aria-label={ds} />
            )
          })}
        </div>
        <div className={styles.legend}>
          <b>Menos sinapses</b>
          {[0, 1, 2, 3, 4].map((n) => <i key={n} className={`${styles.sw} ${heatClass(n)}`} />)}
          <span>Máximo</span>
        </div>
      </section>

      <div className={styles.stats3}>
        <div className={styles.statCard}>
          <Trophy size={14} />
          <strong>{bestLongest?.longest ?? 0}d</strong>
          <small>Maior sequência</small>
          <em>{bestLongest?.longest ? bestLongest.h.name : '—'}</em>
        </div>
        <div className={styles.statCard}>
          <Zap size={14} />
          <strong className={styles.accent}>{bestCurrent?.current ?? 0}d</strong>
          <small>Sequência ativa</small>
          <em>{bestCurrent?.current ? bestCurrent.h.name : '—'}</em>
        </div>
        <div className={styles.statCard}>
          <CheckCircle2 size={14} />
          <strong>{completed.toLocaleString('pt-BR')}</strong>
          <small>Concluídos</small>
          <em>Sincronizado na nuvem</em>
        </div>
      </div>

      {catRows.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <span><Activity size={14} /> Consistência por categoria</span>
            <small className={styles.hint}>Registro anual</small>
          </div>
          {catRows.map((c) => (
            <div key={c.id} className={styles.catRow}>
              <div className={styles.rowBetween}>
                <span className={styles.catName}><i className={styles.dot} /> {c.label}</span>
                <span><b className={styles.accentSm}>{c.st.pct}%</b> <small className={styles.hint}>({c.st.done} registros)</small></span>
              </div>
              <span className={styles.track}><i style={{ width: `${c.st.pct}%` }} /></span>
            </div>
          ))}
        </section>
      )}

      {fame.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <span><Trophy size={14} /> Hall dos hábitos</span>
            <em className={styles.badge}>3 hábitos principais</em>
          </div>
          {fame.map(({ h, st }) => {
            const Icon = HABIT_ICONS[h.icon ?? 'custom'] ?? HABIT_ICONS.custom
            return (
              <div key={h.id} className={styles.fameRow}>
                <Ring pct={st.pct} />
                <div className={styles.rowText}><strong>{h.name}</strong><small>{st.done} dias ativos em {year}</small></div>
                <span className={styles.iconBox}><Icon size={15} /></span>
              </div>
            )
          })}
        </section>
      )}

      {isCurrentYear && (
        <section className={styles.projection}>
          <div className={styles.sectionHead}>
            <span><BrainCircuit size={15} /> Projeção anual de crescimento</span>
            <em className={styles.badge}>INFORMAÇÃO</em>
          </div>
          <p>
            {velocity !== null ? `Na sua velocidade mensal atual de ${velocity >= 0 ? '+' : ''}${velocity}%` : 'No seu ritmo atual'}, você ultrapassará{' '}
            <b>{projected.toLocaleString('pt-BR')} conclusões anuais de hábitos</b> até 31 de dezembro.
          </p>
          <span className={styles.tactical}>
            <Lightbulb size={13} />
            {weak
              ? `Foco tático: proteja a consistência de ${weak.habit.name} às ${WEEKDAY_NAMES[weak.weekday]}.`
              : 'Foco tático: continue registrando para desbloquear informações personalizadas.'}
          </span>
        </section>
      )}

      <div className={styles.exportRow}>
        <button type="button" className={styles.exportBtn} onClick={exportJson}><Download size={14} /> Exportar relatório de {year} (.JSON)</button>
        <button type="button" className={styles.shareBtn} onClick={share}><Share2 size={14} /> Compartilhar mapa</button>
      </div>
    </>
  )
}
