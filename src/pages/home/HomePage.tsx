import { supabase } from '../../lib/supabase'
import { useProfile } from '../../features/profile/useProfile'

export default function HomePage() {
  const { data: profile } = useProfile()
  return (
    <>
      <h1>
        Olá, <span style={{ color: 'var(--color-secondary)' }}>{profile?.display_name}</span>
      </h1>
      <button onClick={() => supabase.auth.signOut()}>Sair</button>
    </>
  )
}