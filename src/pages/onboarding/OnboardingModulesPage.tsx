import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Zap } from 'lucide-react'
import { MODULES } from '../../features/onboarding/modules'
import { useOnboarding } from '../../features/onboarding/useOnboarding'
import styles from './onboarding.module.css'

export default function OnboardingModulesPage() {
  const { data, setData } = useOnboarding()
  const navigate = useNavigate()

  function toggle(id: string) {
    if (id === 'habits') return
    setData((d) => ({
      ...d,
      modules: d.modules.includes(id) ? d.modules.filter((m) => m !== id) : [...d.modules, id],
    }))
  }

  return (
    <>
      <span className={styles.tag}><Zap size={12} /> Central Neural Bioadaptativa</span>
      <h1 className={styles.h1}>O que você deseja otimizar?</h1>
      <p className={styles.lead}>
        Selecione os módulos do seu sistema. Os módulos não selecionados ficam desativados e podem ser ativados a qualquer momento.
      </p>
      <ul className={styles.list}>
        {MODULES.map(({ id, title, desc, icon: Icon, badge }) => {
          const on = data.modules.includes(id)
          return (
            <li key={id}>
              <button type="button" className={styles.moduleCard} onClick={() => toggle(id)} aria-pressed={on}>
                <span className={styles.iconBox}><Icon size={18} /></span>
                <span className={styles.moduleText}>
                  <strong>{title}{badge && <em className={styles.badge}>{badge}</em>}</strong>
                  <small>{desc}</small>
                </span>
                <span className={`${styles.check} ${on ? styles.checkOn : ''}`}>{on && <Check size={14} />}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className={styles.primary} onClick={() => navigate('/onboarding/setup')}>
        Continuar para a configuração <ArrowRight size={16} />
      </button>
    </>
  )
}