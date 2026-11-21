import { supabase } from '../../lib/supabase'

export default function ProfilePage() {
  return (
    <>
      <h1>Profile</h1>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </>
  )
}