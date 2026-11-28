import { Cable, ChartNoAxesColumnIncreasing, ChevronRight, Newspaper, Trophy, UserPlus, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import Dialog from '../ui/Dialog'
import Avatar from '../ui/Avatar'
import { useProfile } from '../../features/profile/useProfile'
import { mainNavigation } from './navigation'
import styles from './SideMenu.module.css'

export default function SideMenu({ onClose }: { onClose: () => void }) {
  const { data: profile } = useProfile()
  const modules = profile?.enabled_modules ?? []
  const main = mainNavigation(modules)
  const links = [
    { to: '/?tab=feed', label: 'Feed', icon: Newspaper },
    { to: '/?tab=feed&section=communities', label: 'Comunidades', icon: UsersRound },
    { to: '/?tab=feed&section=challenges', label: 'Desafios', icon: Trophy },
    { to: '/friends/add', label: 'Adicionar amigos', icon: UserPlus },
    ...(modules.includes('workouts') ? [{ to: '/workouts/stats', label: 'Estatísticas de treino', icon: ChartNoAxesColumnIncreasing }] : []),
    { to: '/profile?tab=connections', label: 'Conexões', icon: Cable },
  ]

  return (
    <Dialog title="Menu" className={styles.drawer} onClose={onClose}>
      <Link to="/profile" className={styles.profile} onClick={onClose}>
        <Avatar name={profile?.display_name} url={profile?.avatar_url} size={48} ring />
        <span><strong>{profile?.display_name || 'Meu perfil'}</strong>{profile?.username && <small>@{profile.username}</small>}</span>
        <ChevronRight size={18} />
      </Link>
      <nav className={styles.navigation} aria-label="Funcionalidades do Hebbian">
        {[main, links].map((group, index) => <ul key={index}>
          {group.map(({ to, label, icon: Icon }) => <li key={to}><Link to={to} onClick={onClose}><Icon size={19} /> {label}</Link></li>)}
        </ul>)}
      </nav>
    </Dialog>
  )
}
