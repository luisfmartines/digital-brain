import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { BrainCircuit, Maximize2 } from 'lucide-react'
import AppHeader from './AppHeader'
import BottomNav from './BottomNav'
import { useProfile } from '../../features/profile/useProfile'
import { useActiveWorkout } from '../../features/workouts/queries'
import { useEnsureWaterHabit } from '../../features/water/queries'
import styles from './AppShell.module.css'

const SUBTITLES: Record<string, string> = {
  '/': 'HOME',
  '/routine': 'ROUTINE',
  '/workouts': 'WORKOUTS',
  '/finance': 'FINANCES',
  '/calendar': 'CALENDAR',
  '/assistant': 'AI ASSISTANT',
  '/profile': 'PROFILE',
}

// true = o botão escuro de treino aparece sempre (fora de /workouts).
// false = só aparece quando há um treino em andamento (atalho para retomar).
const ALWAYS_SHOW_WORKOUT_FAB = false

// Esconde os botões flutuantes ao rolar para baixo e enquanto o teclado está aberto,
// para não cobrirem conteúdo nem campos de texto.
function useHideFabs() {
  const [scrolledDown, setScrolledDown] = useState(false)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (Math.abs(y - last) < 8) return
      setScrolledDown(y > last && y > 80)
      last = y
    }
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)
    const onIn = (e: FocusEvent) => setTyping(isField(e.target))
    const onOut = () => setTyping(false)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('focusin', onIn)
    window.addEventListener('focusout', onOut)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('focusin', onIn)
      window.removeEventListener('focusout', onOut)
    }
  }, [])

  return scrolledDown || typing
}

export default function AppShell() {
  const { pathname } = useLocation()
  const { data: profile } = useProfile()
  const { data: active } = useActiveWorkout()
  const hideFabs = useHideFabs()
  useEnsureWaterHabit() // o hábito de água já vem pronto

  const modules: string[] = profile?.enabled_modules ?? []
  const showAi = modules.includes('assistant') && pathname !== '/assistant'
  const showWorkout =
    modules.includes('workouts') && !pathname.startsWith('/workouts') && (ALWAYS_SHOW_WORKOUT_FAB || !!active)
  const fabCount = Number(showAi) + Number(showWorkout)

  return (
    <div className={styles.shell}>
      <div className={styles.frame}>
        <AppHeader subtitle={SUBTITLES[pathname] ?? 'HOME'} />
        <main className={`${styles.content} ${fabCount === 1 ? styles.contentFab : ''} ${fabCount === 2 ? styles.contentFab2 : ''}`}>
          <Outlet />
        </main>
        {fabCount > 0 && (
          <div className={`${styles.fabs} ${hideFabs ? styles.fabsHidden : ''}`}>
            {showWorkout && (
              <Link
                to={active ? `/workouts/active/${active.id}` : '/workouts'}
                className={`${styles.fab} ${styles.fabDark}`}
                aria-label={active ? 'Resume workout' : 'Workouts'}
              >
                <Maximize2 size={22} />
                {active && <i className={styles.live} />}
              </Link>
            )}
            {showAi && (
              <Link to="/assistant" className={styles.fab} aria-label="AI Assistant">
                <BrainCircuit size={24} />
              </Link>
            )}
          </div>
        )}
        <BottomNav />
      </div>
    </div>
  )
}
