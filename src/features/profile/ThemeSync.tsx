import { useEffect } from 'react'
import { useProfile } from './useProfile'
import { useDevice } from '../../expo/device'

export default function ThemeSync() {
  const { data: profile } = useProfile()
  const setNativeTheme = useDevice()?.setTheme
  const theme = profile?.theme === 'light' ? 'light' : 'dark'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    void setNativeTheme?.(theme)
  }, [theme, setNativeTheme])

  return null
}
