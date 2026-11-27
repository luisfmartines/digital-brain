import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowRight, AtSign, CheckCircle2, ChevronRight, Circle, Eye, EyeOff, Lock,
  LogIn, RefreshCw, ShieldCheck, User, UserPlus,
} from 'lucide-react'
import { createBrowserEmailAuth, supabase } from '../../lib/supabase'
import { PASSWORD_RULES, passwordStrength } from '../../features/auth/password'
import { AUTH_REDIRECT, publicAppOrigin, useDevice } from '../../expo/device'
import { handleAuthReturn } from '../../expo/authReturn'
import styles from './LoginPage.module.css'

type Mode = 'login' | 'signup'

const EMAIL_RE = /^\S+@\S+\.\S+$/
const USERNAME_RE = /^[a-z0-9._]{3,20}$/

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
  const device = useDevice()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [availability, setAvailability] = useState<{ name: string; ok: boolean } | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const signup = mode === 'signup'
  const strength = passwordStrength(password)
  const emailOk = EMAIL_RE.test(email)
  const usernameValid = USERNAME_RE.test(username)

  // Confere se o @ está livre (com pequeno atraso para não consultar a cada tecla)
  useEffect(() => {
    if (!signup || !usernameValid) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc('is_username_available', { u: username })
      if (!cancelled && !rpcError) setAvailability({ name: username, ok: !!data })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [signup, usernameValid, username])

  const userStatus = !username
    ? 'idle'
    : !usernameValid
      ? 'invalid'
      : availability?.name === username
        ? availability.ok ? 'available' : 'taken'
        : 'checking'

  const canSignup = strength.ok && userStatus === 'available'

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (signup) {
      if (!strength.ok) {
        setError('A senha precisa de 6 ou mais caracteres, com maiúscula, minúscula e número.')
        return
      }
      if (userStatus !== 'available') {
        setError('Escolha um nome de usuário disponível.')
        return
      }
    }

    setBusy(true)
    if (!signup) {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) setError(authError.message)
    } else {
      const auth = device?.isExpoGo ? createBrowserEmailAuth() : supabase.auth
      const { data, error: authError } = await auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, username },
          emailRedirectTo: device?.isExpoGo ? publicAppOrigin() : device ? `${AUTH_REDIRECT}/signup` : undefined,
        },
      })
      if (authError) setError(authError.message)
      else if (!data.session) setInfo('Conta criada! Confirme seu e-mail para entrar.')
      else if (device?.isExpoGo) {
        const { error } = await supabase.auth.setSession(data.session)
        if (error) setError(error.message)
      }
    }
    setBusy(false)
  }

  async function handleGoogle() {
    if (device?.isExpoGo) {
      setError(null)
      setInfo('Entre com e-mail e senha no Expo Go. Se sua conta é do Google, informe o mesmo e-mail e use “Esqueceu a senha?” para criar uma senha.')
      return
    }
    const redirectTo = device ? `${AUTH_REDIRECT}/oauth` : window.location.origin
    try {
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: !!device },
      })
      if (authError) throw authError
      if (device && data.url) {
        const result = await device.openAuth(data.url, redirectTo)
        if (result) await handleAuthReturn(new URL(result))
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível entrar com o Google.')
    }
  }

  async function handleForgot() {
    setError(null)
    setInfo(null)
    if (!emailOk) {
      setError('Informe seu endereço de e-mail primeiro.')
      return
    }
    const auth = device?.isExpoGo ? createBrowserEmailAuth() : supabase.auth
    const origin = device && !device.isExpoGo ? AUTH_REDIRECT : publicAppOrigin()
    const { error: authError } = await auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    })
    if (authError) setError(authError.message)
    else setInfo('Link de redefinição enviado. Verifique seu e-mail.')
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{signup ? 'Criar conta' : 'Entrar'}</h1>

        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${!signup ? styles.tabOn : ''}`} onClick={() => switchMode('login')}>
            <LogIn size={16} /> Entrar
          </button>
          <button type="button" className={`${styles.tab} ${signup ? styles.tabOn : ''}`} onClick={() => switchMode('signup')}>
            <UserPlus size={16} /> Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {signup && (
            <>
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="name">Nome completo</label>
                  <span className={styles.hint}>Identificação cognitiva</span>
                </div>
                <div className={styles.inputWrap}>
                  <User size={18} />
                  <input id="name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="username">Usuário</label>
                  <span className={userStatus === 'taken' ? styles.bad : styles.hint}>
                    {userStatus === 'taken' && 'Já está em uso'}
                    {userStatus === 'invalid' && '3–20 caracteres: a-z, 0-9, . _'}
                    {userStatus === 'checking' && 'Verificando…'}
                    {userStatus === 'available' && 'Disponível'}
                    {userStatus === 'idle' && 'Seu @usuário'}
                  </span>
                </div>
                <div className={styles.inputWrap}>
                  <span className={styles.at}>@</span>
                  <input
                    id="username"
                    className={styles.input}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20))}
                    required
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="seu usuário"
                  />
                  {userStatus === 'available' && <CheckCircle2 size={18} className={styles.ok} />}
                </div>
              </div>
            </>
          )}

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor="email">{signup ? 'Endereço de e-mail' : 'Endereço de e-mail'}</label>
              {!signup && <span className={styles.hint}>Profissional ou pessoal</span>}
            </div>
            <div className={styles.inputWrap}>
              <AtSign size={18} />
              <input id="email" className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              {signup && emailOk && <CheckCircle2 size={18} className={styles.ok} />}
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor="password">Senha</label>
              {signup ? (
                <span className={styles.hint}>Média ou mais forte</span>
              ) : (
                <button type="button" className={styles.link} onClick={handleForgot}>Esqueceu a senha?</button>
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
                autoComplete={signup ? 'new-password' : 'current-password'}
              />
              <button type="button" className={styles.eye} onClick={() => setShowPw((v) => !v)} aria-label="Mostrar ou ocultar senha">
                {showPw ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>

          {signup && (
            <div className={styles.strength}>
              {password.length > 0 && (
                <>
                  <div className={styles.strengthRow}>
                    <span className={styles.strengthLabel}>
                      <i /> {strength.label} · {password.length} chars
                    </span>
                    <span className={styles.hint}>
                      Segurança · {strength.level >= 3 ? 'Alta' : strength.level === 2 ? 'Média' : 'Baixa'}
                    </span>
                  </div>
                  <div className={styles.meter}>
                    {[1, 2, 3, 4].map((n) => (
                      <span key={n} className={n <= strength.level ? styles.segOn : styles.seg} />
                    ))}
                  </div>
                </>
              )}
              <ul className={styles.rules}>
                {PASSWORD_RULES.map((r) => {
                  const met = r.test(password)
                  return (
                    <li key={r.id} className={met ? styles.ruleOk : ''}>
                      {met ? <CheckCircle2 size={12} /> : <Circle size={12} />} {r.label}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
          {info && <p className={styles.info}>{info}</p>}

          <button className={styles.primary} type="submit" disabled={busy || (signup && !canSignup)}>
            {busy ? 'Aguarde…' : signup ? 'Criar conta' : 'Entrar'} <ArrowRight size={16} />
          </button>
        </form>

        <div className={styles.divider}><span>OU CONTINUE COM</span></div>

        <button type="button" className={styles.google} onClick={handleGoogle}>
          <GoogleG />
          <span className={styles.googleText}>
            <strong>Continuar com Google</strong>
            {signup && <small>Nome e foto sincronizados automaticamente</small>}
          </span>
          <ChevronRight size={16} />
        </button>
        {!signup && (
          <p className={styles.sync}><RefreshCw size={12} /> Sincroniza perfil e foto da conta Google automaticamente</p>
        )}

        {signup ? (
          <>
            <p className={styles.already}>
              Already have an account?{' '}
              <button type="button" className={styles.link} onClick={() => switchMode('login')}>Entrar</button>
            </p>
            <span className={styles.secure}><ShieldCheck size={12} /> Criptografado em trânsito e em repouso</span>
            <p className={styles.terms}>
              Ao criar uma conta, você concorda com nossos <u>Termos de Uso</u> e <u>Política de Privacidade</u>.
            </p>
          </>
        ) : (
          <p className={styles.terms}>
            Ao continuar, você concorda com nossos <u>Termos de Uso</u> e <u>Política de Privacidade</u>. Criptografado em trânsito e em repouso.
          </p>
        )}
      </div>
    </div>
  )
}
