import { useState } from 'react'
import { Menu, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../ui/Avatar'
import { useProfile } from '../../features/profile/useProfile'
import SideMenu from './SideMenu'
import styles from './AppHeader.module.css'

export default function AppHeader({ title }: { title: string }) {
  const { data: profile } = useProfile()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className={styles.header}>
      <div className={styles.actions}>
        <button type="button" className={styles.iconBtn} onClick={() => setMenuOpen(true)} aria-label="Abrir menu lateral" aria-haspopup="dialog">
          <Menu size={22} />
        </button>
        <span className={styles.title}>{title}</span>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.iconBtn} onClick={() => navigate('/friends/add')} aria-label="Adicionar amigos">
          <UserPlus size={20} />
        </button>
        <button type="button" className={styles.avatarBtn} onClick={() => navigate('/profile')} aria-label="Perfil">
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={34} ring />
        </button>
      </div>
      {menuOpen && <SideMenu onClose={() => setMenuOpen(false)} />}
    </header>
  )
}
