import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { appIcon } from '../../expo/device'
import { useProfile } from '../../features/profile/useProfile'
import { defaultOnboardingData, type OnboardingData } from '../../features/onboarding/types'
import styles from './onboarding.module.css'

const STEPS = ['modules', 'setup', 'habits', 'ready']
const CHIPS = ['1. Módulos', '2. Finanças e Treinos', '3. Hábitos', '4. Pronto']

export default function OnboardingLayout() {
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: profile } = useProfile()
  const step = Math.max(STEPS.findIndex((s) => pathname.endsWith(s)), 0) + 1

  const back = (
    <button type="button" className={styles.iconBtn} onClick={() => navigate(-1)} disabled={step === 1} aria-label="Voltar">
      <ArrowLeft size={20} />
    </button>
  )
  const avatar = <Avatar url={profile?.avatar_url} name={profile?.display_name} size={32} />
  const skip = () => navigate('/onboarding/ready')

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        {step === 1 ? (
          <>
            <div className={styles.topbar}>
              {back}
              <img src={appIcon} alt="" className={styles.miniLogo} />
              <span className={styles.topTitle}>Boas-vindas</span>
              {avatar}
            </div>
            <div className={styles.stepRow}>
              <span className={styles.stepLabel}><i className={styles.dot} /> ETAPA 1 DE 4 • MÓDULOS</span>
              <button type="button" className={styles.skipPill} onClick={skip}>Pular configuração</button>
            </div>
            <div className={styles.bar}><div className={styles.barFill} style={{ width: '25%' }} /></div>
            <div className={styles.stepChips}>
              {CHIPS.map((c, i) => (
                <span key={c} className={`${styles.stepChip} ${i === 0 ? styles.stepChipOn : ''}`}>{c}</span>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.topbar}>
            {back}
            <img src={appIcon} alt="" className={styles.miniLogo} />
            <div className={styles.centerProgress}>
              <span className={styles.miniLabel}>ETAPA <b>{step} DE 4</b></span>
              <div className={styles.bar}><div className={styles.barFill} style={{ width: `${step * 25}%` }} /></div>
            </div>
            {step < 4 && <button type="button" className={styles.skipText} onClick={skip}>Pular</button>}
            {avatar}
          </div>
        )}
        <main className={styles.main}>
          <Outlet context={{ data, setData }} />
        </main>
      </div>
    </div>
  )
}
