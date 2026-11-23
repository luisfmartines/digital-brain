import { supabase } from '../../lib/supabase'

export default function ProfilePage() {
  return (
    <>
      <h1>Perfil</h1>
      <button onClick={() => supabase.auth.signOut()}>Sair</button>
    </>
  )
}