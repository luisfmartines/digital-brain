import { useState, type FormEvent } from 'react'
import {
  ArrowRight, AtSign, CheckCircle2, ChevronRight, Eye, EyeOff, Lock,
  LogIn, RefreshCw, ShieldCheck, User, UserPlus,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import styles from './LoginPage.module.css'

type Mode = 'login' | 'signup'

const EMAIL_RE = /^\S+@\S+\.\S+$/
const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']

function strengthOf(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  return score
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const signup = mode === 'signup'
  const score = strengthOf(password)
  const emailOk = EMAIL_RE.test(email)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)

    if (!signup) {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) setError(authError.message)
    } else {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (authError) setError(authError.message)
      else if (!data.session) setInfo('Account created! Confirm your email to log in.')
    }
    setBusy(false)
  }

  async function handleGoogle() {
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (authError) setError(authError.message)
  }

  async function handleForgot() {
    setError(null)
    setInfo(null)
    if (!emailOk) {
      setError('Enter your email address first.')
      return
    }
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (authError) setError(authError.message)
    else setInfo('Password reset link sent. Check your email.')
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <div className={styles.logoBox}>
          <img src="/icons/icon-192.png" alt="" />
          {signup && <span className={styles.logoDot} />}
        </div>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Digital Brain</h1>
          <span className={styles.badge}>PERSONAL OS</span>
        </div>
        <p className={styles.subtitle}>Synchronize your life, focus &amp; performance</p>

        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${!signup ? styles.tabOn : ''}`} onClick={() => switchMode('login')}>
            <LogIn size={16} /> Log in
          </button>
          <button type="button" className={`${styles.tab} ${signup ? styles.tabOn : ''}`} onClick={() => switchMode('signup')}>
            <UserPlus size={16} /> Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {signup && (
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="name">Full Name</label>
                <span className={styles.hint}>Cognitive Key</span>
              </div>
              <div className={styles.inputWrap}>
                <User size={18} />
                <input id="name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </div>
            </div>
          )}

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor="email">{signup ? 'Email Address' : 'Email address'}</label>
              {!signup && <span className={styles.hint}>Work or personal</span>}
            </div>
            <div className={styles.inputWrap}>
              <AtSign size={18} />
              <input id="email" className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              {signup && emailOk && <CheckCircle2 size={18} className={styles.ok} />}
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor="password">Password</label>
              {signup ? (
                <span className={styles.hint}>Min. 6 characters</span>
              ) : (
                <button type="button" className={styles.link} onClick={handleForgot}>Forgot password?</button>
              )}
            </div>
            <div className={styles.inputWrap}>
              <Lock size={18} />
              <input
                id="password"
                className={styles.input}
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={signup ? 'new-password' : 'current-password'}
              />
              <button type="button" className={styles.eye} onClick={() => setShowPw((v) => !v)} aria-label="Show or hide password">
                {showPw ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>

          {signup && password.length > 0 && (
            <div className={styles.strength}>
              <div className={styles.strengthRow}>
                <span className={styles.strengthLabel}>
                  <i /> {STRENGTH_LABELS[score]} · {password.length} chars
                </span>
                <span className={styles.hint}>Entropy · {score >= 3 ? 'High' : score === 2 ? 'Medium' : 'Low'}</span>
              </div>
              <div className={styles.meter}>
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className={n <= score ? styles.segOn : styles.seg} />
                ))}
              </div>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
          {info && <p className={styles.info}>{info}</p>}

          <button className={styles.primary} type="submit" disabled={busy}>
            {busy ? 'Please wait…' : signup ? 'Create Account' : 'Log In'} <ArrowRight size={16} />
          </button>
        </form>

        <div className={styles.divider}><span>OR CONTINUE WITH</span></div>

        <button type="button" className={styles.google} onClick={handleGoogle}>
          <GoogleG />
          <span className={styles.googleText}>
            <strong>Continue with Google</strong>
            {signup && <small>Name &amp; profile picture sync automatically</small>}
          </span>
          <ChevronRight size={16} />
        </button>
        {!signup && (
          <p className={styles.sync}><RefreshCw size={12} /> Syncs Google account profile &amp; avatar automatically</p>
        )}

        {signup ? (
          <>
            <p className={styles.already}>
              Already have an account?{' '}
              <button type="button" className={styles.link} onClick={() => switchMode('login')}>Log in</button>
            </p>
            <span className={styles.secure}><ShieldCheck size={12} /> Encrypted in transit &amp; at rest</span>
            <p className={styles.terms}>
              By signing up, you agree to our <u>Terms of Service</u> &amp; <u>Privacy Policy</u>.
            </p>
          </>
        ) : (
          <p className={styles.terms}>
            By continuing, you agree to our <u>Terms of Service</u> and <u>Privacy Policy</u>. Encrypted in transit and at rest.
          </p>
        )}
      </div>
    </div>
  )
}