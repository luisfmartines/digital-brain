import { useState, type ReactNode } from 'react'
import { Maximize2 } from 'lucide-react'
import { fmtNum } from '../../features/workouts/utils'
import styles from './stats.module.css'

interface VolumeBucket {
  label: string
  long: string
  volume: number
  workouts: number
}

export default function VolumeChart({ buckets, total, workouts, activeWeeks, comparison, axis }: {
  buckets: VolumeBucket[]
  total: number
  workouts: number
  activeWeeks?: number
  comparison?: ReactNode
  axis?: ReactNode
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const maxVolume = Math.max(1, ...buckets.map((bucket) => bucket.volume))
  const lastWorkout = buckets.reduce((last, bucket, index) => bucket.workouts ? index : last, 0)
  const currentIndex = selected ?? (axis ? buckets.length - 1 : lastWorkout)
  const current = buckets[currentIndex]
  if (!current) return null

  return (
    <section className={styles.card} aria-label="Volume">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}><i className={styles.cardIcon}><Maximize2 size={15} /></i> Volume</h2>
        <span className={styles.tag}>{axis ? 'Tonelagem total' : 'Semana atual'}</span>
      </div>
      <div className={styles.bigRow}>
        <b className={styles.big}>{fmtNum(total)}</b><span className={styles.unit}>kg</span>
        {comparison}
      </div>
      <small className={styles.avg}>
        Média: {fmtNum(total / Math.max(1, workouts))} kg por treino
        {activeWeeks !== undefined && ` • ${activeWeeks} ${activeWeeks === 1 ? 'semana ativa' : 'semanas ativas'}`}
      </small>
      <p className={styles.hintStrip} aria-live="polite"><i /> {current.long}: {current.workouts
        ? `${fmtNum(current.volume)} kg • ${current.workouts} ${current.workouts === 1 ? 'treino' : 'treinos'}`
        : 'nenhum treino'}</p>
      <div className={styles.bars}>
        {buckets.map((bucket, index) => (
          <button key={bucket.long} type="button" aria-label={bucket.long + ': ' + fmtNum(bucket.volume) + ' kg'}
            aria-pressed={index === currentIndex} className={index === currentIndex ? styles.barOn : styles.bar}
            style={{ height: Math.max(bucket.volume ? 5 : 2, bucket.volume / maxVolume * 100) + '%' }}
            onClick={() => setSelected(index)} />
        ))}
      </div>
      {axis ?? <div className={styles.dayAxis} aria-hidden="true">
        {buckets.map((bucket) => <span key={bucket.long}>{bucket.label}</span>)}
      </div>}
    </section>
  )
}
