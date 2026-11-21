import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Calendar, Cloud, Flame, Maximize2, Repeat, SlidersHorizontal, Sparkles, Wallet, Zap, ShieldCheck } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { useAuth } from '../../features/auth/useAuth'
import { useProfile } from '../../features/profile/useProfile'
import { useOnboarding } from '../../features/onboarding/useOnboarding'
import { saveOnboarding } from '../../features/onboarding/saveOnboarding'
import { fmtTime, formatBRL } from '../../features/onboarding/utils'
import styles from './onboarding.module.css'

const RANKS = ['Voyager', 'Explorer', 'Navigator', 'Architect', 'Master']
const CORE_LABEL: Record<string, string> = {
  muscle_gain: 'HYPERTROPHY CORE', fat_loss: 'FAT LOSS CORE', strength: 'STRENGTH CORE', longevity: 'LONGEVITY CORE',
}

export default function OnboardingReadyPage() {
  const { data } = useOnboarding()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finance = data.modules.includes('finance')
  const workouts = data.modules.includes('workouts')
  const auto = ['tasks', 'calendar', 'assistant'].some((m) => data.modules.includes(m))
  const habits = data.habits.filter((h) => h.active)
  const engines = 1 + Number(finance) + Number(workouts) + Number(auto)
  const savings = Math.round(data.monthlyIncome * data.savingsPct) / 100
  const tier = ['beginner', 'intermediate', 'advanced'].indexOf(data.experience) + 1

  const level = profile?.level ?? 1
  const xpNow = (profile?.xp ?? 0) + 100
  const xpNext = 100 * (level + 1) * level
  const username = '@' + (user?.email?.split('@')[0] ?? 'you').toLowerCase()

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      await saveOnboarding(user!.id, data)
      await queryClient.refetchQueries({ queryKey: ['profile'] })
      navigate('/', { replace: true })
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not save. Please try again.')
      setBusy(false)
    }
  }

  return (
    <>
      <span className={`${styles.tag} ${styles.tagCenter}`}><i className={styles.dot} /> SYSTEM READY · SYNC COMPLETE</span>
      <h1 className={`${styles.h1} ${styles.center}`}>Your Digital Brain is Calibrated</h1>
      <p className={`${styles.lead} ${styles.center}`}>
        Here is your personalized cockpit, {profile?.display_name?.split(' ')[0] ?? ''}. Unselected modules sleep silently and wake whenever you need them.
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
        <div className={styles.cloudTag}><Cloud size={12} /> CLOUD SYNC<small>Personal OS</small></div>
      </section>

      <section className={styles.section}>
        <div className={styles.rowBetween}>
          <div className={styles.xpTitle}>
            <Zap size={16} />
            <div><span className={styles.cap}>ONBOARDING BOOST</span><strong>+100 XP Unlocked</strong></div>
          </div>
          <span className={styles.xpCount}>{xpNow} <small>/{xpNext} XP</small></span>
        </div>
        <div className={styles.bar}><div className={styles.barFill} style={{ width: `${Math.min(100, (xpNow / xpNext) * 100)}%` }} /></div>
        <div className={styles.rankRow}>
          <span className={styles.rank}>Rank: Level {level} {RANKS[level - 1] ?? 'Master'}</span>
          <span className={styles.rank}>System Architect</span>
          <span className={styles.rank}>Day 1 Pioneer</span>
        </div>
      </section>

      <div className={styles.rowBetween}>
        <span className={styles.sectionLabel}>ACTIVE SYNAPSE ENGINES <span className={styles.badge}>{engines} Active</span></span>
        <span className={styles.accentSm}>All Systems Green</span>
      </div>

      {finance && (
        <section className={styles.section}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Wallet size={18} /></span>
            <div className={styles.cardTitle}><strong>Capital &amp; Liquidity</strong><small>Cashflow &amp; budget tracking</small></div>
            <span className={styles.badge}>READY</span>
          </div>
          <div className={styles.stats}>
            <div><span className={styles.cap}>MONTHLY NET FLOW</span><strong>{formatBRL(data.monthlyIncome)}</strong></div>
            <div><span className={styles.cap}>TARGET SAVINGS ({data.savingsPct}%)</span><strong>{formatBRL(savings)}</strong></div>
          </div>
        </section>
      )}

      {workouts && (
        <section className={styles.section}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Maximize2 size={18} /></span>
            <div className={styles.cardTitle}><strong>Workouts &amp; Hypertrophy</strong><small>Adaptive Progressive Overload</small></div>
            <span className={styles.badge}>Tier {tier}</span>
          </div>
          <div className={styles.strip}>
            <Calendar size={12} /> {data.weeklyFrequency} Days / Week Split
            <span className={styles.primed}>{CORE_LABEL[data.trainingGoal]}</span>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.cardHead}>
          <span className={styles.iconBox}><Repeat size={18} /></span>
          <div className={styles.cardTitle}><strong>Identity Habits</strong><small>Streak Shield Active (1 Grace/14d)</small></div>
          <span className={styles.badge}>{habits.length} Loops Primed</span>
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
            <div className={styles.cardTitle}><strong>Autonomous Baseline</strong><small>Daily brief, smart schedule, AI notes</small></div>
            <span className={styles.badge}>STANDARD</span>
          </div>
        </section>
      )}

      <section className={styles.infoBox}>
        <ShieldCheck size={16} />
        <div>
          <strong>Secure Cloud Sync</strong>
          <p>Your data syncs to your account and is available on every device where you log in. The bottom navigation bar has been re-indexed to match your active engines.</p>
        </div>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      <button type="button" className={styles.primary} onClick={finish} disabled={busy}>
        {busy ? 'Saving…' : 'Enter Digital Brain'} <Zap size={16} />
      </button>
      <button type="button" className={styles.ghost} onClick={() => navigate('/onboarding/setup')}>
        <SlidersHorizontal size={14} /> Modify Engine Parameters
      </button>
    </>
  )
}