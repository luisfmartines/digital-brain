import { useState, type FormEvent } from 'react'
import { ArrowLeft, ChevronRight, UsersRound } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ActivityPicker from '../../components/ui/ActivityPicker'
import { useAuth } from '../../features/auth/useAuth'
import { useCommunity, useSaveCommunity, type Community } from '../../features/social/communities'
import type { ActivityCategory } from '../../features/workouts/activities'
import { AddSocialPhoto, PhotoPreview } from './SocialPhotos'
import styles from './Social.module.css'

const directory = '/?tab=feed&section=communities'

function CommunityEditor({ existing }: { existing?: Community }) {
  const [id] = useState(() => existing?.id ?? crypto.randomUUID())
  const [name, setName] = useState(existing?.name ?? '')
  const [bio, setBio] = useState(existing?.bio ?? '')
  const [category, setCategory] = useState<ActivityCategory>(existing?.category ?? 'Musculação')
  const [choosing, setChoosing] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [keepCover, setKeepCover] = useState(true)
  const [picking, setPicking] = useState(false)
  const save = useSaveCommunity(existing)
  const navigate = useNavigate()
  const busy = save.isPending || picking
  const title = existing ? 'Editar comunidade' : 'Criar comunidade'
  const currentCover = keepCover ? existing?.photo_url : null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || name.trim().length < 2) return
    save.mutate({ id, name: name.trim(), bio: bio.trim(), category, photo, keepCover }, {
      onSuccess: (id) => navigate('/feed/communities/' + id, { replace: true }),
    })
  }

  return (
    <main className={styles.standalone}>
      <header className={styles.pageHeader}>
        <Link to={existing ? '/feed/communities/' + id : directory} className={styles.iconButton} aria-label={existing ? 'Voltar à comunidade' : 'Voltar às comunidades'} onClick={(event) => { if (busy) event.preventDefault() }}><ArrowLeft size={20} /></Link>
        <h1>{title}</h1>
      </header>
      <form className={styles.form} onSubmit={submit}>
        <fieldset className={styles.fields} disabled={busy}>
          <div className={styles.coverEditor}>
            {photo ? <PhotoPreview file={photo} alt="Foto da comunidade" disabled={busy} onRemove={() => setPhoto(null)} />
              : <span className={styles.coverLarge}>{currentCover ? <img src={currentCover} alt="Foto atual da comunidade" /> : <UsersRound size={34} />}</span>}
            <AddSocialPhoto label={photo || currentCover ? 'Trocar foto' : 'Adicionar foto'} onPicking={setPicking} onAdd={setPhoto} disabled={busy} />
            {currentCover && !photo && <button type="button" className={styles.secondary} onClick={() => setKeepCover(false)}>Remover foto</button>}
          </div>
          <label>Nome da comunidade<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={64} /></label>
          <label>Bio<textarea value={bio} rows={5} onChange={(event) => setBio(event.target.value)} maxLength={500} placeholder="Conte para quem é a comunidade e o que vocês fazem juntos." /></label>
          <button type="button" className={styles.chooseModality} aria-label="Modalidade" aria-haspopup="dialog" onClick={() => setChoosing(true)}>
            <span><small>Modalidade</small><strong>{category}</strong></span><ChevronRight size={19} />
          </button>
          <p className={styles.muted}>A comunidade aparece no diretório e qualquer pessoa com conta pode entrar.</p>
        </fieldset>
        {save.isError && <p className={styles.error} role="alert">{save.error.message}</p>}
        <button className={styles.primary} type="submit" disabled={busy || name.trim().length < 2}>
          {save.isPending ? 'Salvando…' : existing ? 'Salvar alterações' : title}
        </button>
      </form>
      {choosing && <ActivityPicker value={category} onClose={() => setChoosing(false)} onSelect={(value) => { setCategory(value); setChoosing(false) }} />}
    </main>
  )
}

export default function CommunityFormPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const query = useCommunity(id)
  if (!id) return <CommunityEditor />
  if (query.isPending) return <main className={styles.standalone}><p role="status">Carregando comunidade…</p></main>
  if (query.isSuccess && query.data && query.data.owner_id === user?.id) return <CommunityEditor key={id} existing={query.data} />
  return <main className={styles.standalone}>
    <Link className={styles.textLink} to={directory}><ArrowLeft size={18} /> Voltar às comunidades</Link>
    <p role="alert" className={styles.error}>{query.isError
      ? 'Não foi possível carregar a comunidade.'
      : 'Somente o dono pode editar esta comunidade.'}</p>
    {query.isError && <button className={styles.secondary} type="button" onClick={() => query.refetch()}>Tentar novamente</button>}
  </main>
}
