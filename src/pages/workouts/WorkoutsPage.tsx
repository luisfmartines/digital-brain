import { useSearchParams } from 'react-router-dom'
import TrainingView from './TraningView'
import FeedView from './FeedView'
import RankingView from './RankingView'
import styles from './workouts.module.css'

const TABS = [
  { id: 'train', label: 'Treinamento' },
  { id: 'feed', label: 'Feed dos amigos' },
  { id: 'ranking', label: 'Classificação' },
]

export default function WorkoutsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'train'

  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? styles.tabOn : styles.tab} onClick={() => setParams({ tab: t.id }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'feed' ? <FeedView /> : tab === 'ranking' ? <RankingView /> : <TrainingView />}
    </div>
  )
}