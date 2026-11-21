import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/useAuth'

export default function OnboardingModulesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function finish() {
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user!.id)
    await queryClient.refetchQueries({ queryKey: ['profile'] })
    navigate('/')
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Onboarding 1/4</h1>
      <button onClick={finish}>Concluir (teste)</button>
    </div>
  )
}