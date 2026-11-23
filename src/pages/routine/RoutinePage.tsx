import { useSearchParams } from 'react-router-dom'
import { useProfile } from '../../features/profile/useProfile'
import TasksPage from '../tasks/TasksPage'
import HabitsPage from '../habits/HabitsPage'
import styles from './Routine.module.css'

type Tab = 'tasks' | 'habits'

const TABS: { id: Tab; label: string }[] = [
  { id: 'tasks', label: 'Tarefas' },
  { id: 'habits', label: 'Hábitos' },
]

export default function RoutinePage() {
  const { data: profile } = useProfile()
  const [params, setParams] = useSearchParams()
  const modules: string[] = profile?.enabled_modules ?? []

  // Só mostra as abas dos módulos ativos (se nenhum estiver ativo, mostra as duas)
  const enabled = TABS.filter((t) => modules.includes(t.id))
  const tabs = enabled.length ? enabled : TABS
  const requested = params.get('tab')
  const tab: Tab = tabs.find((t) => t.id === requested)?.id ?? tabs[0].id

  return (
    <div className={styles.page}>
      {tabs.length > 1 && (
        <div className={styles.tabs} role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? styles.tabOn : styles.tab}
              onClick={() => setParams({ tab: t.id }, { replace: true })}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {tab === 'habits' ? <HabitsPage /> : <TasksPage />}
    </div>
  )
}
