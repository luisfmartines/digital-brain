import { Search, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../ui/Avatar'
import { useProfile } from '../../features/profile/useProfile'
import styles from './AppHeader.module.css'

export default function AppHeader({ subtitle }: { subtitle: string }) {
  const { data: profile } = useProfile()
  const navigate = useNavigate()

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img src="/icons/icon-192.png" alt="" className={styles.logo} />
        <div>
          <div className={styles.title}>Digital Brain</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.iconBtn} aria-label="Pesquisar">
          <Search size={20} />
        </button>
        <button type="button" className={styles.iconBtn} onClick={() => navigate('/friends/add')} aria-label="Adicionar amigos">
          <UserPlus size={20} />
        </button>
        <button type="button" className={styles.avatarBtn} onClick={() => navigate('/profile')} aria-label="Perfil">
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={34} ring />
        </button>
      </div>
    </header>
  )
}