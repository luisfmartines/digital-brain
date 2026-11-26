import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { passwordStrength } from '../../features/auth/password'
import styles from './LoginPage.module.css'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const strength = passwordStrength(password)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!strength.ok) {
      setError('A senha precisa de 6 ou mais caracteres, com maiúscula, minúscula e número.')
      return
    }
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
        <h1 className={styles.title}>Nova senha</h1>
        <p className={styles.subtitle}>6 ou mais caracteres, com maiúscula, minúscula e número</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrap}>
            <Lock size={18} />
            <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" placeholder="Nova senha" />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.primary} type="submit" disabled={busy || !strength.ok}>{busy ? 'Salvando…' : 'Salvar senha'}</button>
        </form>
      </div>
    </div>
  )
}
