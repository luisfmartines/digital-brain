import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, Copy, Search, Share2, Sparkles, UserCheck, UserPlus } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { useProfile } from '../../features/profile/useProfile'
import {
  useFollowers, useFollowing, useFollowToggle, useSearchProfiles, useSuggestedProfiles, type Profile,
} from '../../features/social/queries'
import styles from './AddFriends.module.css'

const DISMISS_KEY = 'db:dismissed-followers'

function loadDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function Row({ p, sub, children }: { p: Profile; sub?: string; children: ReactNode }) {
  return (
    <li className={styles.row}>
      <Avatar url={p.avatar_url} name={p.display_name ?? p.username} size={44} />
      <div className={styles.rowText}>
        <Link className={styles.profileLink} to={`/profiles/${p.id}`}><strong>{p.display_name ?? p.username ?? 'Ver perfil'}</strong></Link>
        <span>@{p.username}</span>
        {sub && <small>{sub}</small>}
      </div>
      {children}
    </li>
  )
}

function ConnectButton({ id, following, busy, onToggle }: { id: string; following: boolean; busy: boolean; onToggle: (id: string, following: boolean) => void }) {
  return (
    <button type="button" className={following ? styles.connected : styles.connect} disabled={busy} onClick={() => onToggle(id, following)}>
      {following ? <><UserCheck size={15} /> Conectado</> : <><UserPlus size={15} /> Conectar</>}
    </button>
  )
}

export default function AddFriendsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: profile } = useProfile()
  const following = useFollowing().data
  const followers = useFollowers().data ?? []
  const suggested = useSuggestedProfiles().data ?? []
  const toggle = useFollowToggle()

  const [q, setQ] = useState(() => params.get('u') ?? '')
  const [copied, setCopied] = useState(false)
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed)
  const results = useSearchProfiles(q)

  const handle = profile?.username ? `@${profile.username}` : ''
  const searching = q.trim().replace(/^@/, '').length >= 2
  const isFollowing = (id: string) => following?.has(id) ?? false
  const onToggle = (id: string, on: boolean) => toggle.mutate({ id, following: on })

  // Quem te segue e você ainda não segue de volta
  const pending = followers.filter((p) => !isFollowing(p.id) && !dismissed.includes(p.id))
  const pendingIds = new Set(pending.map((p) => p.id))
  const recommended = suggested.filter((p) => !isFollowing(p.id) && !pendingIds.has(p.id)).slice(0, 5)

  function dismiss(id: string) {
    const next = [...dismissed, id]
    setDismissed(next)
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next))
    } catch {
      // sem storage: só esconde nesta sessão
    }
  }

  async function copyHandle() {
    if (!handle) return
    try {
      await navigator.clipboard.writeText(handle)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard indisponível
    }
  }

  async function sendLink() {
    const url = `${window.location.origin}/friends/add?u=${profile?.username ?? ''}`
    const text = `Me adiciona no Digital Brain: ${handle}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Digital Brain', text, url })
      } catch {
        // cancelado
      }
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Voltar"><ChevronLeft size={24} /></button>
          <h2>Adicionar amigos</h2>
        </header>

        <div>
          <span className={styles.kicker}><i /> REDE NEURAL ATIVA</span>
          <h1 className={styles.title}>Conectar Synapses</h1>
          <p className={styles.lead}>Conecte-se com amigos para sincronizar rotinas de foco, streaks de hábitos e treinos diários.</p>
        </div>

        <section className={styles.me}>
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={56} />
          <div className={styles.rowText}>
            <small>SEU USUÁRIO</small>
            <strong className={styles.handle}>{handle || '—'}</strong>
          </div>
          <button type="button" className={styles.iconBtn} onClick={copyHandle} aria-label="Copiar usuário" disabled={!handle}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </section>

        <label className={styles.search}>
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por @usuário" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </label>

        <button type="button" className={styles.invite} onClick={sendLink} disabled={!handle}>
          <Share2 size={16} /> Enviar link <small>Convidar</small>
        </button>

        {searching ? (
          <section>
            <h3 className={styles.section}>Resultados</h3>
            <ul className={styles.list}>
              {(results.data ?? []).map((p) => (
                <Row key={p.id} p={p}>
                  <ConnectButton id={p.id} following={isFollowing(p.id)} busy={toggle.isPending} onToggle={onToggle} />
                </Row>
              ))}
            </ul>
            {results.data?.length === 0 && <p className={styles.empty}>Ninguém encontrado com esse @usuário.</p>}
          </section>
        ) : (
          <>
            {pending.length > 0 && (
              <section>
                <h3 className={styles.section}>Querem se conectar <b>{pending.length}</b></h3>
                <ul className={styles.list}>
                  {pending.map((p) => (
                    <li key={p.id} className={styles.card}>
                      <Row p={p} sub="Seguiu você">{null}</Row>
                      <div className={styles.actions}>
                        <button type="button" className={styles.ghost} onClick={() => dismiss(p.id)}>Ignorar</button>
                        <button type="button" className={styles.accept} disabled={toggle.isPending} onClick={() => onToggle(p.id, false)}><Check size={15} /> Seguir de volta</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className={styles.section}>Recomendados para você <Sparkles size={14} /></h3>
              {recommended.length === 0 ? (
                <p className={styles.empty}>Sem recomendações por enquanto. Busque pelo @ de um amigo ou envie seu link.</p>
              ) : (
                <ul className={styles.list}>
                  {recommended.map((p) => (
                    <Row key={p.id} p={p} sub={p.level ? `Nível ${p.level}` : undefined}>
                      <ConnectButton id={p.id} following={false} busy={toggle.isPending} onToggle={onToggle} />
                    </Row>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
