import { useSearchParams } from 'react-router-dom'
import TrainingView from './TraningView'
import RankingView from './RankingView'
import styles from './workouts.module.css'

const TABS = [
  { id: 'train', label: 'Treinamento' },
  { id: 'ranking', label: 'Classificação' },
]

export default function WorkoutsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'ranking' ? 'ranking' : 'train'

  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? styles.tabOn : styles.tab} onClick={() => setParams({ tab: t.id }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'ranking' ? <RankingView /> : <TrainingView />}
    </div>
  )
}