import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, ArrowDown, ArrowUp, Check, History, LineChart, Maximize2, RotateCw, Timer, Zap } from 'lucide-react'
import { useWorkoutLog } from '../../features/workouts/queries'
import {
  bucketize, breakdown, makeBuckets, periodWindow, pctChange, summarize, toMetrics,
  type Bucket, type Metric, type Period,
} from '../../features/workouts/stats'
import { fmtNum, mins } from './helpers'
import w from './workouts.module.css'
import styles from './stats.module.css'

const PERIODS: { id: Period; label: string }[] = [
  { id: '3m', label: '3 meses' },
  { id: '1y', label: '1 ano' },
  { id: 'all', label: 'Todo o período' },
]

function Delta({ value }: { value: number | null }) {
  if (value === null) return null
  const up = value >= 0
  return (
    <span className={up ? styles.deltaUp : styles.deltaDown}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />} {up ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}

function Axis({ buckets }: { buckets: Bucket[] }) {
  const n = buckets.length
  const idx = [...new Set([0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1])]
  return (
    <div className={styles.axis}>
      { idx.map((i) => <span key={i}>{i === n - 1 ? 'Agora' : buckets[i].label}</span>) }
    </div>
  )
}

// Curva suave passando pelos pontos
function smooth(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return ''
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`
  }
  return d
}

const W = 320
const H = 130
const PAD = { l: 10, r: 10, t: 14, b: 8 }

function Charts({ metrics }: { metrics: Metric[] }) {
  const [period, setPeriod] = useState<Period>('3m')
  const [barSel, setBarSel] = useState<number | null>(null)
  const [ptSel, setPtSel] = useState<number | null>(null)
  const [mode, setMode] = useState<'muscle' | 'exercise'>('muscle')

  const d = useMemo(() => {
    const now = new Date()
    const first = metrics.length ? metrics[metrics.length - 1].at : null
    const { from, prevFrom } = periodWindow(period, now, first)
    const cur = metrics.filter((m) => m.at >= from)
    const prev = prevFrom ? metrics.filter((m) => m.at >= prevFrom && m.at < from) : []
    const buckets = bucketize(cur, makeBuckets(period, from, now))
    const spanWeeks = Math.max(1, Math.ceil((now.getTime() - from.getTime()) / (7 * 86400000)))
    return { cur, buckets, spanWeeks, s: summarize(cur), p: summarize(prev), hasPrev: prev.length > 0 }
  }, [metrics, period])

  const { s, p, buckets } = d
  const delta = (a: number, b: number) => (d.hasPrev ? pctChange(a, b) : null)
  const n = Math.max(1, s.workouts)

  const maxVol = Math.max(1, ...buckets.map((b) => b.volume))
  const volSel = barSel ?? buckets.length - 1
  const vb = buckets[Math.min(volSel, buckets.length - 1)]

  const avgOf = (b: Bucket) => (b.workouts ? b.minutes / b.workouts : 0)
  const withData = buckets.map((b, i) => ({ b, i })).filter((x) => x.b.workouts > 0)
  const maxAvg = Math.max(1, ...withData.map((x) => avgOf(x.b)))
  const pts = withData.map(({ b, i }) => ({
    x: PAD.l + (buckets.length > 1 ? (i / (buckets.length - 1)) * (W - PAD.l - PAD.r) : (W - PAD.l - PAD.r) / 2),
    y: PAD.t + (1 - avgOf(b) / (maxAvg * 1.15)) * (H - PAD.t - PAD.b),
    b,
  }))
  const ptIdx = Math.min(ptSel ?? pts.length - 1, pts.length - 1)
  const line = smooth(pts)
  const base = H - PAD.b

  const rows = useMemo(() => breakdown(d.cur, mode), [d.cur, mode])
  const maxReps = Math.max(1, ...rows.map((r) => r.reps))

  return (
    <>
      <div className={styles.periods}>
        {PERIODS.map((x) => (
          <button key={x.id} type="button" className={period === x.id ? styles.periodOn : styles.period} onClick={() => { setPeriod(x.id); setBarSel(null); setPtSel(null) }}>{x.label}</button>
        ))}
      </div>

      <section className={styles.overview}>
        <span className={styles.ovIcon}><Activity size={20} /></span>
        <div className={w.rText}>
          <small className={styles.kicker}>VISÃO DO PERÍODO</small>
          <strong className={styles.ovTitle}>{s.workouts} {s.workouts === 1 ? 'treino' : 'treinos'} • {fmtNum(s.sets)} séries</strong>
        </div>
        <span className={styles.badgeGreen}><Zap size={11} /> {(s.workouts / d.spanWeeks).toFixed(1)} por semana</span>
      </section>

      {s.workouts === 0 ? (
        <p className={w.empty}>Nenhum treino neste período. Finalize um treino para ver os gráficos aqui.</p>
      ) : (
        <>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}><i className={styles.cardIcon}><Maximize2 size={15} /></i> Volume</span>
              <span className={styles.tag}>Tonelagem total</span>
            </div>
            <div className={styles.bigRow}>
              <b className={styles.big}>{fmtNum(s.volume)}</b><span className={styles.unit}>kg</span>
              <Delta value={delta(s.volume, p.volume)} />
            </div>
            <small className={styles.avg}>Média: {fmtNum(s.volume / n)} kg por treino • {s.weeks} {s.weeks === 1 ? 'semana ativa' : 'semanas ativas'}</small>
            <p className={styles.hintStrip}><i /> {vb.workouts > 0 ? `${vb.long}: ${fmtNum(vb.volume)} kg • ${vb.workouts} ${vb.workouts === 1 ? 'treino' : 'treinos'}` : `${vb.long}: nenhum treino`}</p>
            <div className={styles.bars}>
              {buckets.map((b, i) => (
                <button
                  key={b.start.getTime()} type="button" aria-label={`${b.long}: ${fmtNum(b.volume)} kg`}
                  className={i === volSel ? styles.barOn : styles.bar}
                  style={{ height: `${Math.max(b.volume ? 5 : 2, (b.volume / maxVol) * 100)}%` }}
                  onClick={() => setBarSel(i)}
                />
              ))}
            </div>
            <Axis buckets={buckets} />
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}><i className={styles.cardIcon}><Timer size={15} /></i> Duração</span>
              <span className={styles.tag}>Tempo em atividade</span>
            </div>
            <div className={styles.bigRow}>
              <b className={styles.big}>{fmtNum(s.minutes)}</b><span className={styles.unit}>min</span>
              <span className={styles.unit}>(~{(s.minutes / 60).toFixed(1)} h)</span>
              <Delta value={delta(s.minutes, p.minutes)} />
            </div>
            <small className={styles.avg}>Média: {mins(s.minutes * 60 / n)} min por treino</small>
            <p className={styles.hintStrip}><i /> {pts[ptIdx] ? `${pts[ptIdx].b.long}: média de ${Math.round(avgOf(pts[ptIdx].b))} min • ${pts[ptIdx].b.workouts} ${pts[ptIdx].b.workouts === 1 ? 'treino' : 'treinos'}` : 'Selecione um ponto para ver o ritmo'}</p>
            <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label="Duração média dos treinos ao longo do tempo">
              <defs>
                <linearGradient id="durFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0.45 }} />
                  <stop offset="100%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              {pts.length > 1 && (
                <>
                  <path d={`${line} L${pts[pts.length - 1].x},${base} L${pts[0].x},${base} Z`} fill="url(#durFill)" />
                  <path d={line} fill="none" strokeWidth="2.5" strokeLinecap="round" className={styles.line} />
                </>
              )}
              {pts.map((pt, i) => (
                <g key={pt.b.start.getTime()} onClick={() => setPtSel(i)} className={styles.pt}>
                  <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
                  <circle cx={pt.x} cy={pt.y} r={i === ptIdx ? 5 : 3.5} className={i === ptIdx ? styles.dotOn : styles.dot} />
                </g>
              ))}
            </svg>
            <Axis buckets={buckets} />
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}><i className={styles.cardIcon}><RotateCw size={15} /></i> Repetições</span>
              <select className={styles.select} value={mode} onChange={(e) => setMode(e.target.value as 'muscle' | 'exercise')} aria-label="Agrupar repetições por">
                <option value="muscle">Por grupo muscular</option>
                <option value="exercise">Por exercício</option>
              </select>
            </div>
            <div className={styles.bigRow}>
              <b className={styles.big}>{fmtNum(s.reps)}</b><span className={styles.unit}>repetições</span>
              <Delta value={delta(s.reps, p.reps)} />
            </div>
            <small className={styles.avg}>Média: {fmtNum(s.reps / n)} repetições por treino</small>
            <ul className={styles.repList}>
              {rows.map((r, i) => (
                <li key={r.label}>
                  <div className={styles.repHead}><span><i style={{ opacity: 1 - i * 0.15 }} /> {r.label}</span><b>{fmtNum(r.reps)} repetições</b></div>
                  <div className={styles.track}><div className={styles.fill} style={{ width: `${(r.reps / maxReps) * 100}%`, opacity: 1 - i * 0.12 }} /></div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  )
}

const PAGE = 20

function Logbook({ metrics }: { metrics: Metric[] }) {
  const navigate = useNavigate()
  const [shown, setShown] = useState(PAGE)
  const list = metrics.slice(0, shown)

  if (metrics.length === 0) return <p className={w.empty}>Seu registro está vazio. Finalize um treino para salvá-lo aqui.</p>

  let last = ''
  return (
    <>
      <p className={styles.count}>{metrics.length} {metrics.length === 1 ? 'treino registrado' : 'treinos registrados'}</p>
      <ul className={w.list}>
        {list.map((m) => {
          const month = m.at.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
          const head = month !== last
          last = month
          return (
            <li key={m.id} className={styles.logItem}>
              {head && <h3 className={styles.month}>{month}</h3>}
              <button type="button" className={`${w.hItem} ${styles.itemBtn}`} onClick={() => navigate(`/workouts/view/${m.id}`)}>
                <span className={w.hIcon}><Check size={14} /></span>
                <div className={w.rText}>
                  <strong>{m.name} <i className={w.hintTag}>{m.at.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</i></strong>
                  <small>{mins(m.minutes * 60)} min • {fmtNum(m.volume)} kg de volume • {m.sets} séries</small>
                </div>
                <div className={w.hRight}><strong>{m.pct}%</strong><small>Concluído</small></div>
              </button>
            </li>
          )
        })}
      </ul>
      {shown < metrics.length && <button type="button" className={styles.more} onClick={() => setShown(shown + PAGE)}>Mostrar mais</button>}
    </>
  )
}

export default function StatsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'history' ? 'history' : 'charts'
  const { data, isLoading, isError } = useWorkoutLog()
  const metrics = useMemo(() => toMetrics(data ?? []), [data])

  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? styles.tabOn : styles.tab} onClick={() => setParams({ tab: 'history' }, { replace: true })}><History size={14} /> Histórico</button>
        <button type="button" role="tab" aria-selected={tab === 'charts'} className={tab === 'charts' ? styles.tabOn : styles.tab} onClick={() => setParams({ tab: 'charts' }, { replace: true })}><LineChart size={14} /> Gráficos</button>
      </div>
      {isLoading ? <p className={w.loading}>Carregando…</p>
        : isError ? <p className={w.error}>Não foi possível carregar seus treinos. Tente novamente em alguns instantes.</p>
        : tab === 'history' ? <Logbook metrics={metrics} /> : <Charts metrics={metrics} />}
    </div>
  )
}
