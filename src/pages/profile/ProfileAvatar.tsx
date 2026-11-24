import { useState } from 'react'
import Avatar from '../../components/ui/Avatar'
import Dialog from '../../components/ui/Dialog'
import styles from './Profile.module.css'

export default function ProfileAvatar({ url, name, size }: {
  url?: string | null; name?: string | null; size: number
}) {
  const [open, setOpen] = useState(false)
  const thumbnail = <Avatar url={url} name={name} size={size} ring />
  if (!url) return thumbnail

  return (
    <>
      <button type="button" className={styles.avatarViewerTrigger} aria-label="Ampliar foto de perfil"
        aria-haspopup="dialog" onClick={() => setOpen(true)}>{thumbnail}</button>
      {open && <Dialog title={name ? 'Foto de ' + name : 'Foto de perfil'} onClose={() => setOpen(false)}>
        <img className={styles.avatarViewerImage} src={url} alt={name ? 'Foto de perfil de ' + name : 'Foto de perfil'} />
      </Dialog>}
    </>
  )
}
