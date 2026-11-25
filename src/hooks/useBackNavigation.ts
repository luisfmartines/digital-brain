import { useNavigate } from 'react-router-dom'

export function useBackNavigation(fallback: string) {
  const navigate = useNavigate()

  return () => {
    if (window.history.state?.idx > 0) {
      navigate(-1)
      return
    }
    navigate(fallback, { replace: true })
  }
}
