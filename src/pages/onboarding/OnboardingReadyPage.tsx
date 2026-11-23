import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Cloud, Flame, Repeat, ShieldCheck, SlidersHorizontal, Sparkles, Wallet, Zap } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { useAuth } from '../../features/auth/useAuth'
import { useProfile } from '../../features/profile/useProfile'
import { useOnboarding } from '../../features/onboarding/useOnboarding'
import { saveOnboarding } from '../../features/onboarding/saveOnboarding'
import { fmtTime, formatBRL } from '../../features/onboarding/utils'
import styles from './onboarding.module.css'

const RANKS = ['Viajante', 'Explorador', 'Navegador', 'Arquiteto', 'Mestre']

export default function OnboardingReadyPage() {
  const { data } = useOnboarding()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finance = data.modules.includes('finance')
  const auto = ['tasks', 'calendar', 'assistant'].some((m) => data.modules.includes(m))
  const habits = data.habits.filter((h) => h.active)
  const engines = 1 + Number(finance) + Number(auto)
  const savings = Math.round(data.monthlyIncome * data.savingsPct) / 100

  const level = profile?.level ?? 1
  const xpNow = (profile?.xp ?? 0) + 100
  const xpNext = 100 * (level + 1) * level
  const username = '@' + (profile?.username ?? user?.email?.split('@')[0] ?? 'you')

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      await saveOnboarding(user!.id, data)
      await queryClient.refetchQueries({ queryKey: ['profile'] })
      navigate('/', { replace: true })
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Não foi possível salvar. Tente novamente.')
      setBusy(false)
    }
  }

  return (
    <>
      <span className={`${styles.tag} ${styles.tagCenter}`}><i className={styles.dot} /> SISTEMA PRONTO · SINCRONIZAÇÃO CONCLUÍDA</span>
      <h1 className={`${styles.h1} ${styles.center}`}>Seu Digital Brain está pronto</h1>
      <p className={`${styles.lead} ${styles.center}`}>
        Este é seu painel personalizado, {profile?.display_name?.split(' ')[0] ?? ''}. Os módulos não selecionados podem ser ativados quando você precisar.
      </p>

      <section className={styles.profileCard}>
        <div className={styles.avatarWrap}>
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={46} />
          <span className={styles.statusDot} />
        </div>
        <div className={styles.cardTitle}>
          <strong>{profile?.display_name} <BadgeCheck size={14} className={styles.verified} /></strong>
          <small>{username}</small>
        </div>
        <div className={styles.cloudTag}><Cloud size={12} /> SINCRONIZAÇÃO NA NUVEM<small>Sistema pessoal</small></div>
      </section>

      <section className={styles.section}>
        <div className={styles.rowBetween}>
          <div className={styles.xpTitle}>
            <Zap size={16} />
            <div><span className={styles.cap}>BÔNUS DE CONFIGURAÇÃO</span><strong>+100 XP desbloqueados</strong></div>
          </div>
          <span className={styles.xpCount}>{xpNow} <small>/{xpNext} XP</small></span>
        </div>
        <div className={styles.bar}><div className={styles.barFill} style={{ width: `${Math.min(100, (xpNow / xpNext) * 100)}%` }} /></div>
        <div className={styles.rankRow}>
          <span className={styles.rank}>Classe: nível {level} {RANKS[level - 1] ?? 'Mestre'}</span>
          <span className={styles.rank}>Arquiteto do sistema</span>
          <span className={styles.rank}>Pioneiro do dia 1</span>
        </div>
      </section>

      <div className={styles.rowBetween}>
        <span className={styles.sectionLabel}>MÓDULOS ATIVOS <span className={styles.badge}>{engines} ativos</span></span>
        <span className={styles.accentSm}>Tudo pronto</span>
      </div>

      {finance && (
        <section className={styles.section}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Wallet size={18} /></span>
            <div className={styles.cardTitle}><strong>Capital e Liquidez</strong><small>Controle de fluxo de caixa e orçamento</small></div>
            <span className={styles.badge}>PRONTO</span>
          </div>
          <div className={styles.stats}>
            <div><span className={styles.cap}>FLUXO LÍQUIDO MENSAL</span><strong>{formatBRL(data.monthlyIncome)}</strong></div>
            <div><span className={styles.cap}>META DE ECONOMIA ({data.savingsPct}%)</span><strong>{formatBRL(savings)}</strong></div>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.cardHead}>
          <span className={styles.iconBox}><Repeat size={18} /></span>
          <div className={styles.cardTitle}><strong>Hábitos de identidade</strong><small>Proteção ativa (1 folga a cada 14 dias)</small></div>
          <span className={styles.badge}>{habits.length} ciclos ativos</span>
        </div>
        {habits.map((h) => (
          <div key={h.key} className={styles.strip}>
            <Flame size={12} /> {h.name}
            <span className={styles.muted}>{fmtTime(h.time)}</span>
          </div>
        ))}
      </section>

      {auto && (
        <section className={styles.section}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Sparkles size={18} /></span>
            <div className={styles.cardTitle}><strong>Configuração automática</strong><small>Resumo diário, agenda inteligente e notas por IA</small></div>
            <span className={styles.badge}>PADRÃO</span>
          </div>
        </section>
      )}

      <section className={styles.infoBox}>
        <ShieldCheck size={16} />
        <div>
          <strong>Sincronização segura na nuvem</strong>
          <p>Seus dados são sincronizados com sua conta e ficam disponíveis em todos os dispositivos onde você entrar.</p>
        </div>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      <button type="button" className={styles.primary} onClick={finish} disabled={busy}>
        {busy ? 'Salvando…' : 'Entrar no Digital Brain'} <Zap size={16} />
      </button>
      <button type="button" className={styles.ghost} onClick={() => navigate('/onboarding/setup')}>
        <SlidersHorizontal size={14} /> Ajustar parâmetros
      </button>
    </>
  )
}