import { UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../ui/Avatar'
import { useProfile } from '../../features/profile/useProfile'
import styles from './AppHeader.module.css'

export default function AppHeader({ title }: { title: string }) {
  const { data: profile } = useProfile()
  const navigate = useNavigate()

  return (
    <header className={styles.header}>
      <span className={styles.title}>{title}</span>
      <div className={styles.actions}>
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
