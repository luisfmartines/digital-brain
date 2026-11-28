import { useState, type FormEvent } from 'react'
import { ChevronDown, Globe2, Send } from 'lucide-react'
import Dialog from '../../components/ui/Dialog'
import ActivityPicker from '../../components/ui/ActivityPicker'
import Avatar from '../../components/ui/Avatar'
import { useProfile } from '../../features/profile/useProfile'
import { MAX_PHOTOS, usePublishPost } from '../../features/social/publishing'
import type { ActivityCategory } from '../../features/workouts/activities'
import { AddSocialPhoto, PhotoPreview } from './SocialPhotos'
import styles from './Social.module.css'

export default function PostComposer({ onClose, onPublished }: {
  onClose: () => void; onPublished: () => void
}) {
  const { data: profile } = useProfile()
  const [id] = useState(() => crypto.randomUUID())
  const [caption, setCaption] = useState('')
  const [category, setCategory] = useState<ActivityCategory>('Musculação')
  const [choosing, setChoosing] = useState(false)
  const [discoverable, setDiscoverable] = useState(false)
  const [photos, setPhotos] = useState<{ id: string; file: File }[]>([])
  const [picking, setPicking] = useState(false)
  const publish = usePublishPost()
  const busy = publish.isPending || picking

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    publish.mutate({
      id, caption: caption.trim(), discoverable, photos: photos.map(({ file }) => file),
      category,
    }, { onSuccess: onPublished })
  }

  return (
    <Dialog title="Adicionar treino" onClose={onClose} busy={busy} className={styles.composer}>
      <form className={styles.composeForm} onSubmit={submit}>
        <fieldset disabled={busy} className={styles.composeBody}>
          <div className={styles.composeAuthor}>
            <Avatar url={profile?.avatar_url} name={profile?.display_name} size={48} />
            <div>
              <strong>{profile?.display_name || profile?.username || 'Seu perfil'}</strong>
              <button className={styles.modalityTrigger} type="button" aria-label="Modalidade" aria-haspopup="dialog" onClick={() => setChoosing(true)}>{category} <ChevronDown size={15} /></button>
            </div>
          </div>
          <textarea aria-label="Legenda do treino" placeholder="O que você fez hoje?"
            rows={4} maxLength={1500} value={caption} onChange={(e) => setCaption(e.target.value)} />
          {photos.length > 0 && <div className={styles.previews}>{photos.map(({ id, file }, i) =>
            <PhotoPreview key={id} file={file} alt={'Foto ' + (i + 1)} disabled={busy}
              onRemove={() => setPhotos((current) => current.filter((photo) => photo.id !== id))} />)}
          </div>}
          <div className={styles.attachments}>
            {photos.length < MAX_PHOTOS && <AddSocialPhoto label="Adicionar foto" onPicking={setPicking}
              onAdd={(file) => setPhotos((current) => [...current, { id: crypto.randomUUID(), file }])} disabled={busy} />}
            <small>{photos.length}/{MAX_PHOTOS} fotos</small>
          </div>
          {publish.isError && <p className={styles.error} role="alert">{publish.error.message}</p>}
        </fieldset>
        <footer className={styles.composeFooter}>
          <label className={styles.audience}>
            <input type="checkbox" checked={discoverable} disabled={busy} onChange={(e) => setDiscoverable(e.target.checked)} />
            <Globe2 size={17} /> Mostrar em Explorar
          </label>
          <button className={styles.primary} type="submit" disabled={busy}>
            <Send size={17} /> {publish.isPending ? 'Publicando…' : 'Publicar treino'}
          </button>
        </footer>
      </form>
      {choosing && <ActivityPicker value={category} onClose={() => setChoosing(false)} onSelect={(value) => { setCategory(value); setChoosing(false) }} />}
    </Dialog>
  )
}
