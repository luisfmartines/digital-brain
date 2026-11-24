import { useEffect } from 'react'
import { useProfile } from './useProfile'

export default function ThemeSync() {
  const { data: profile } = useProfile()
  const theme = profile?.theme === 'light' ? 'light' : 'dark'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return null
}
