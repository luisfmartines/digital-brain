import { useMemo, useState } from 'react'
import { ArrowLeft, Link2, Pause, Play, Search, Trophy, Unlink } from 'lucide-react'
import { muscleName, suggestQuery } from '../../features/exercisedb/api'
import { useExerciseLink, useExerciseMedia, useExerciseSearch, useLinkExercise, useUnlinkExercise } from '../../features/exercisedb/queries'
import { useExerciseHistory, type Exercise } from '../../features/workouts/queries'
import {
  METRICS, RANGES, hasWeight, inRange, metricValue, records,
  type HistSession, type MetricId, type RangeId,
} from '../../features/workouts/exerciseStats'
import { fmtNum, muscleLabel } from '../../features/workouts/utils'
import styles from './exerciseDetail.module.css'
import ExerciseImage from './ExerciseImage'
import type { ExerciseMedia } from '../../features/exercisedb/types'
import { cleanInstruction, translateText } from '../../features/exercisedb/translate'

type Tab = 'summary' | 'history' | 'instructions'
const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Resumo' },
  { id: 'history', label: 'Histórico' },
  { id: 'instructions', label: 'Instruções' },
]

const shortDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
const longDate = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
const kg = (n: number) => `${Number(n.toFixed(1)).toLocaleString('pt-BR')} kg`

/* ---------- Animação do exercício ---------- */

function Demo({ video, image, name, externalId }: { video: string | null; image: string | null; name: string; externalId: string }) {
  const [paused, setPaused] = useState(false)
  const [ref, setRef] = useState<HTMLVideoElement | null>(null)

  function toggle() {
    if (!ref) return
    if (ref.paused) { void ref.play(); setPaused(false) } else { ref.pause(); setPaused(true) }
  }
  return (
    <div className={styles.demo}>
      {video ? (
        <>
          <video ref={setRef} src={video} poster={image ?? undefined} autoPlay loop muted playsInline aria-label={`Demonstração: ${name}`} />
          <button type="button" className={styles.pauseBtn} onClick={toggle} aria-label={paused ? 'Reproduzir' : 'Pausar'}>
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        </>
      ) : (
        <ExerciseImage key={externalId} src={image} externalId={externalId} name={name} />
      )}
    </div>
  )
}

/* ---------- Vincular ao exercício da ExerciseDB ---------- */

function LinkPanel({ exercise }: { exercise: Exercise }) {
  const initial = useMemo(() => suggestQuery(exercise.name), [exercise.name])
  const [q, setQ] = useState(initial)
  const [term, setTerm] = useState(initial)
  const search = useExerciseSearch(term)
  const link = useLinkExercise(exercise.id)

  return (
    <section className={styles.linkPanel}>
      <strong>Adicionar demonstração</strong>
      <p>Escolha o exercício equivalente na base de exercícios. Os nomes na base estão em inglês.</p>
      <form className={styles.searchRow} onSubmit={(e) => { e.preventDefault(); setTerm(q) }}>
        <label className={styles.searchBox}><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: pull up" /></label>
        <button type="submit">Buscar</button>
      </form>
      {search.isLoading && <p className={styles.muted}>Buscando…</p>}
      {search.isError && <p className={styles.err}>Não foi possível buscar agora. Verifique a configuração da ExerciseDB e tente de novo.</p>}
      {search.data && search.data.length === 0 && <p className={styles.muted}>Nada encontrado. Tente o nome em inglês.</p>}
      <ul className={styles.results}>
        {search.data?.map((r) => (
          <li key={r.id}>
            <button type="button" disabled={link.isPending} onClick={() => link.mutate(r.id)}>
              <ExerciseImage key={r.id} src={r.imageUrl} externalId={r.id} name={r.name} />
              <span><strong>{r.name}</strong><small>{[...r.targets.map(muscleName), ...r.equipments.map(translateText)].slice(0, 2).join(' • ')}</small></span>
            </button>
          </li>
        ))}
      </ul>
      {link.isError && <p className={styles.err}>Não foi possível salvar o vínculo.</p>}
    </section>
  )
}

/* ---------- Gráfico de evolução ---------- */

const W = 320
const H = 170
const PAD = { l: 44, r: 10, t: 12, b: 8 }

function niceMax(v: number) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

function Chart({ points, unit }: { points: { at: Date; value: number }[]; unit: string }) {
  if (points.length === 0) return <p className={styles.muted}>Sem treinos neste período.</p>
  const lo = Math.min(...points.map((p) => p.value))
  const hi = Math.max(...points.map((p) => p.value))
  const top = niceMax(hi)
  // Quando todos os valores são parecidos, mostra uma faixa curta em volta deles
  const spread = hi - lo
  const min = spread / top < 0.15 ? Math.max(0, Math.floor(lo - Math.max(1, hi * 0.1))) : 0
  const max = spread / top < 0.15 ? Math.ceil(hi + Math.max(1, hi * 0.1)) : top
  const t0 = points[0].at.getTime()
  const span = Math.max(1, points[points.length - 1].at.getTime() - t0)
  const x = (d: Date) => PAD.l + (points.length === 1 ? (W - PAD.l - PAD.r) / 2 : ((d.getTime() - t0) / span) * (W - PAD.l - PAD.r))
  const y = (v: number) => PAD.t + (1 - (v - min) / Math.max(1, max - min)) * (H - PAD.t - PAD.b - 18)
  const ticks = [min, (min + max) / 2, max]
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.at)},${y(p.value)}`).join(' ')
  const fmt = (v: number) => `${Number(v.toFixed(1)).toLocaleString('pt-BR')} ${unit}`
  return (
    <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução do exercício">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={styles.grid} />
          <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" className={styles.tick}>{fmt(t)}</text>
        </g>
      ))}
      <path d={path} className={styles.line} />
      {points.map((p) => <circle key={p.at.getTime()} cx={x(p.at)} cy={y(p.value)} r={3.5} className={styles.dot} />)}
      <text x={PAD.l} y={H - 2} textAnchor="start" className={styles.tick}>{shortDate(points[0].at)}</text>
      <text x={W - PAD.r} y={H - 2} textAnchor="end" className={styles.tick}>{shortDate(points[points.length - 1].at)}</text>
    </svg>
  )
}

/* ---------- Abas ---------- */

function Summary({ exercise, history, primary, secondary }: { exercise: Exercise; history: HistSession[]; primary: string[]; secondary: string[] }) {
  const weighted = hasWeight(history)
  const [selectedMetric, setMetric] = useState<MetricId | null>(null)
  const metric = selectedMetric ?? (weighted ? 'weight' : 'reps')
  const [range, setRange] = useState<RangeId>('3m')
  const m = METRICS.find((x) => x.id === metric)!
  const shown = inRange(history, range)
  const points = shown.map((s) => ({ at: s.at, value: metricValue(s, metric) }))
  const last = points[points.length - 1]
  const rec = records(history)
  const chips = METRICS.filter((x) => weighted || x.id === 'reps' || x.id === 'sessionReps')

  return (
    <>
      <section className={styles.block}>
        <h2>{exercise.name}</h2>
        <p className={styles.muscles}>Primário: {primary.join(', ') || muscleLabel(exercise.muscle_group)}</p>
        {secondary.length > 0 && <p className={styles.muscles}>Secundário: {secondary.join(', ')}</p>}
        {exercise.equipment && <p className={styles.muscles}>Equipamento: {exercise.equipment}</p>}
      </section>

      <section className={styles.block}>
        <div className={styles.chartHead}>
          <div className={styles.big}>
            {last ? <><b>{fmtNum(last.value)} {m.unit}</b> <span>{shortDate(last.at)}</span></> : <b>—</b>}
          </div>
          <select value={range} onChange={(e) => setRange(e.target.value as RangeId)} aria-label="Período">
            {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <Chart points={points} unit={m.unit} />
        <div className={styles.chips}>
          {chips.map((c) => (
            <button key={c.id} type="button" className={metric === c.id ? styles.chipOn : styles.chip} onClick={() => setMetric(c.id)}>{c.label}</button>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h3 className={styles.recTitle}><Trophy size={16} /> Recordes pessoais</h3>
        {history.length === 0 ? (
          <p className={styles.muted}>Os recordes aparecem depois que você registrar séries deste exercício.</p>
        ) : (
          <dl className={styles.records}>
            {rec.maxWeight !== null && <div><dt>Maior peso</dt><dd>{kg(rec.maxWeight)}</dd></div>}
            {rec.best1rm !== null && <div><dt>1RM estimado</dt><dd>{kg(rec.best1rm)}</dd></div>}
            {rec.bestSetVolume !== null && <div><dt>Melhor volume (série)</dt><dd>{kg(rec.bestSetVolume)}</dd></div>}
            <div><dt>Mais repetições (série)</dt><dd>{rec.maxReps} reps</dd></div>
            {rec.bestSessionVolume > 0 && <div><dt>Melhor volume (sessão)</dt><dd>{kg(rec.bestSessionVolume)}</dd></div>}
          </dl>
        )}
      </section>
    </>
  )
}

function History({ history }: { history: HistSession[] }) {
  if (history.length === 0) return <p className={styles.empty}>Você ainda não registrou séries deste exercício.</p>
  return (
    <ul className={styles.histList}>
      {[...history].reverse().map((s) => {
        let n = 0
        return (
          <li key={s.id} className={styles.block}>
            <strong>{s.name}</strong>
            <small>{longDate(s.at)}</small>
            <ol>
              {s.sets.map((x) => {
                if (!x.is_warmup) n += 1
                return (
                  <li key={x.id}>
                    <span className={x.is_warmup ? styles.warm : styles.setNo}>{x.is_warmup ? 'A' : n}</span>
                    {x.weight_kg ? `${kg(x.weight_kg)} × ${x.reps ?? '—'}` : `${x.reps ?? '—'} repetições`}
                  </li>
                )
              })}
            </ol>
          </li>
        )
      })}
    </ul>
  )
}

function Instructions({ media, linked, loading, failed }: { media: ReturnType<typeof useExerciseMedia>['data']; linked: boolean; loading: boolean; failed: boolean }) {
  if (!linked) return <p className={styles.empty}>Adicione a demonstração na aba Resumo para ver as instruções.</p>
  if (loading) return <p className={styles.empty}>Carregando…</p>
  if (failed || !media) return <p className={styles.empty}>Não foi possível carregar as instruções agora.</p>
  const none = !media.overview && media.instructions.length === 0 && media.tips.length === 0 && media.variations.length === 0
  return (
    <>
      {media.overview && <section className={styles.block}><h3>Visão geral</h3><p>{media.overview}</p></section>}
      {media.instructions.length > 0 && (
        <section className={styles.block}><h3>Como fazer</h3><ol className={styles.steps}>{media.instructions.map((t, i) => <li key={i}>{t}</li>)}</ol></section>
      )}
      {media.tips.length > 0 && (
        <section className={styles.block}><h3>Dicas</h3><ul className={styles.bullets}>{media.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></section>
      )}
      {media.variations.length > 0 && (
        <section className={styles.block}><h3>Variações</h3><ul className={styles.bullets}>{media.variations.map((t, i) => <li key={i}>{t}</li>)}</ul></section>
      )}
      {none && <p className={styles.empty}>Este exercício não tem instruções na base.</p>}
      <p className={styles.note}>Conteúdo da ExerciseDB traduzido automaticamente para português, com ajustes de terminologia.</p>
      {!!media.originalInstructions?.length && <details className={styles.block}><summary>Ver instruções originais em inglês</summary><ol className={styles.steps}>{media.originalInstructions.map((text, i) => <li key={i}>{cleanInstruction(text)}</li>)}</ol></details>}
    </>
  )
}

/* ---------- Tela ---------- */

export default function ExerciseDetail({ exercise, onClose, onAdd, previewMedia, adding, addError }: {
  exercise: Exercise; onClose: () => void; onAdd?: () => void; previewMedia?: ExerciseMedia; adding?: boolean; addError?: boolean
}) {
  const [tab, setTab] = useState<Tab>('summary')
  const linkQ = useExerciseLink(previewMedia ? undefined : exercise.id)
  const externalId = previewMedia?.id ?? linkQ.data ?? null
  const mediaQ = useExerciseMedia(externalId)
  const unlink = useUnlinkExercise(exercise.id)
  const histQ = useExerciseHistory(previewMedia ? undefined : exercise.id)
  const history = histQ.data ?? []
  const media = mediaQ.data ?? previewMedia

  const primary = media?.targets.map(muscleName) ?? []
  const secondary = media?.secondary.map(muscleName) ?? []

  return (
    <div className={styles.screen} role="dialog" aria-modal="true" aria-label={exercise.name}>
      <div className={styles.frame}>
        <header className={styles.head}>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Voltar"><ArrowLeft size={22} /></button>
          <strong>{exercise.name}</strong>
          {externalId && !previewMedia ? (
            <button type="button" className={styles.iconBtn} onClick={() => unlink.mutate()} disabled={unlink.isPending} aria-label="Trocar demonstração" title="Trocar demonstração"><Unlink size={18} /></button>
          ) : <span className={styles.iconBtn} />}
        </header>

        <nav className={styles.tabs} role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? styles.tabOn : styles.tab} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>

        <div className={styles.body}>
          {tab === 'summary' && (
            <>
              {externalId ? (
                mediaQ.isLoading ? <div className={styles.demoSkeleton} /> : media && <Demo video={media.videoUrl} image={media.imageUrl} name={exercise.name} externalId={externalId} />
              ) : linkQ.isLoading ? <div className={styles.demoSkeleton} /> : linkQ.isError ? (
                <p className={styles.err}>Não foi possível carregar o vínculo da demonstração. <button type="button" onClick={() => linkQ.refetch()}>Tentar novamente</button></p>
              ) : (
                <LinkPanel exercise={exercise} />
              )}
              {externalId && mediaQ.isError && <p className={styles.err}><Link2 size={13} /> Não foi possível carregar a demonstração agora.</p>}
              {unlink.isError && <p className={styles.err}>Não foi possível remover o vínculo. Tente novamente.</p>}
              {histQ.isError ? <p className={styles.err}>Não foi possível carregar a evolução. <button type="button" onClick={() => histQ.refetch()}>Tentar novamente</button></p> : <Summary exercise={exercise} history={history} primary={primary} secondary={secondary} />}
            </>
          )}
          {tab === 'history' && (histQ.isLoading ? <p className={styles.empty}>Carregando…</p> : histQ.isError ? <p className={styles.err}>Não foi possível carregar o histórico. <button type="button" onClick={() => histQ.refetch()}>Tentar novamente</button></p> : <History history={history} />)}
          {tab === 'instructions' && <Instructions media={media} linked={!!externalId} loading={mediaQ.isLoading} failed={mediaQ.isError} />}
        </div>

        {onAdd && <div className={styles.footer}>{addError && <p role="alert" className={styles.err}>Não foi possível adicionar o exercício. Tente novamente.</p>}<button type="button" onClick={onAdd} disabled={adding}>{adding ? 'Adicionando…' : 'Adicionar exercício'}</button></div>}
      </div>
    </div>
  )
}
