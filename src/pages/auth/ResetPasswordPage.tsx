import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import styles from './LoginPage.module.css'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setBusy(false)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <div className={styles.logoBox}><img src="/icons/icon-192.png" alt="" /></div>
        <h1 className={styles.title} style={{ marginTop: 16 }}>New password</h1>
        <p className={styles.subtitle}>Choose a new password for your account</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrap}>
            <Lock size={18} />
            <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoComplete="new-password" placeholder="New password" />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.primary} type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        </form>
      </div>
    </div>
  )
}