import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Connections from './Connections'
import { useProfileActivity, useProfileSharing } from '../../features/social/sharedProfile'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Brain, Camera, Globe2, LogOut, Moon, Pencil, Sun, Trash2, Trophy } from 'lucide-react'
import ProfileAvatar from './ProfileAvatar'
import PhotoPicker from '../../components/ui/PhotoPicker'
import AvatarCropDialog from './AvatarCropDialog'
import Dialog from '../../components/ui/Dialog'
import dialogStyles from '../../components/ui/Dialog.module.css'
import { useRoutines } from '../../features/workouts/queries'
import ProfileActivitySections, { OwnProfileFeed, ProfileCounts, ProfilePhotos } from './ProfileActivity'
import { MODULES } from '../../features/onboarding/modules'
import { levelInfo } from '../../features/profile/level'
import { useProfile } from '../../features/profile/useProfile'
import { useUploadAvatar, validateAvatarFile } from '../../features/profile/useUploadAvatar'
import { supabase } from '../../lib/supabase'
import styles from './Profile.module.css'

export default function ProfilePage() {
  const [params] = useSearchParams()
  const connections = params.get('tab') === 'connections'
  const query = useProfile()
  const sharing = useProfileSharing()
  const profile = query.data
  const cache = useQueryClient()
  const navigate = useNavigate()
  const activity = useProfileActivity(connections ? undefined : profile?.id)
  const routines = useRoutines()
  const [deleteText, setDeleteText] = useState<string | null>(null)
  const deleteAccount = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ deleted: boolean }>('delete-account', {
        body: { confirmation: deleteText },
      })
      if (error || !data?.deleted) throw new Error('Não foi possível excluir a conta. Tente novamente.')
    },
    onSuccess: async () => {
      await supabase.auth.signOut({ scope: 'local' })
      cache.clear()
      navigate('/login', { replace: true })
    },
  })
  const avatar = useUploadAvatar()
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [editing, setEditing] = useState(false)
  const [signOutError, setSignOutError] = useState(false)
  const update = useMutation({
    mutationFn: async (changes: { theme: 'light' | 'dark' } | { display_name: string; bio: string | null }) => {
      if (!profile) throw new Error('Perfil indisponível.')
      const { error } = await supabase.from('profiles').update(changes)
        .eq('id', profile.id).select('id').single()
      if (error) throw error
      return profile.id
    },
    onSuccess: async (userId) => {
      await cache.invalidateQueries({ queryKey: ['profile', userId] })
      setEditing(false)
    },
  })

  if (query.isPending) return <p role="status">Carregando perfil…</p>
  if (query.isError || !profile) return <p role="alert">Não foi possível carregar seu perfil.</p>

  const level = levelInfo(profile.xp, profile.level)
  const theme = profile.theme === 'light' ? 'light' : 'dark'
  const activeModules = MODULES.filter(({ id }) => profile.enabled_modules?.includes(id))

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = new FormData(e.currentTarget)
    const displayName = String(values.get('displayName') ?? '').trim()
    if (!displayName) {
      const field = e.currentTarget.elements.namedItem('displayName') as HTMLInputElement
      field.setCustomValidity('Informe um nome.')
      field.reportValidity()
      return
    }
    update.mutate({ display_name: displayName, bio: String(values.get('bio') ?? '').trim() || null })
  }

  async function signOut() {
    setSignOutError(false)
    const { error } = await supabase.auth.signOut()
    setSignOutError(!!error)
  }

  return (
    <div className={styles.page}>
      <h1>Perfil</h1>
      <nav className={styles.themes} aria-label="Configurações do perfil">
        <Link className={styles.button} to="/profile" aria-current={!connections ? 'page' : undefined}>Geral</Link>
        <Link className={styles.button} to="/profile?tab=connections" aria-current={connections ? 'page' : undefined}>Conexões</Link>
      </nav>
      {connections ? <Connections key={params.get('show')} expandGoogle={params.get('show') === 'google'} /> : <>
      <ProfilePhotos photos={activity.data?.photos} />
      <section className={styles.card} aria-label="Dados do perfil">
        <div className={styles.row}>
          <div className={styles.person}>
            <ProfileAvatar url={profile.avatar_url} name={profile.display_name} size={56} />
            <div>
              <h2>{profile.display_name || 'Seu perfil'}</h2>
              {profile.username && <span className={styles.accent}>@{profile.username}</span>}
            </div>
          </div>
          {!editing && <button type="button" className={styles.button} onClick={() => { update.reset(); setEditing(true) }}><Pencil size={14} /> Editar</button>}
        </div>
        <ProfileCounts own activity={activity.data} />
        <PhotoPicker title="Foto do perfil" accept="image/jpeg,image/png,image/webp" camera="user" onPhoto={(file) => {
          const message = validateAvatarFile(file)
          setPhotoError(message)
          avatar.reset()
          if (!message) setPhotoFile(file)
        }}>
          {(open) => (
            <button type="button" className={styles.button + ' ' + styles.avatarUpload} aria-haspopup="dialog" disabled={avatar.isPending} onClick={open}>
              <Camera size={15} />
              {avatar.isPending ? 'Enviando foto…' : profile.avatar_url ? 'Trocar foto' : 'Adicionar foto'}
            </button>
          )}
        </PhotoPicker>
        {photoError && <p className={styles.error} role="alert">{photoError}</p>}
        {photoFile && <AvatarCropDialog file={photoFile} uploading={avatar.isPending} uploadError={avatar.error?.message}
          onClose={() => setPhotoFile(null)} onSave={(blob) => avatar.mutate(blob, { onSuccess: () => setPhotoFile(null) })} />}
        {editing ? (
          <form className={styles.form} onSubmit={save}>
            <label>Nome<input name="displayName" required maxLength={80} defaultValue={profile.display_name ?? ''}
              onInput={(e) => e.currentTarget.setCustomValidity('')} /></label>
            <label>Biografia<textarea name="bio" rows={3} maxLength={300} defaultValue={profile.bio ?? ''} /></label>
            <div className={styles.buttons}>
              <button type="submit" className={styles.button} disabled={update.isPending}>Salvar perfil</button>
              <button type="button" className={styles.button} disabled={update.isPending} onClick={() => { update.reset(); setEditing(false) }}>Cancelar</button>
            </div>
          </form>
        ) : profile.bio && <p className={styles.bio}>{profile.bio}</p>}
      </section>

      {activity.isError && <p className={styles.connectionDetail} role="alert">Não foi possível carregar o resumo de treinos. <button type="button" onClick={() => activity.refetch()}>Tentar novamente</button></p>}
      <ProfileActivitySections own activity={activity.data} routines={routines.data?.map((routine) => ({
        id: routine.id, name: routine.name, focus: routine.focus,
        exercises: routine.routine_exercises.map(({ exercise, target_sets, rest_seconds }) => ({
          name: exercise.name, sets: target_sets, rest: rest_seconds, reps: null,
        })),
      }))} />

      <section className={styles.card}>
        <div className={styles.person}>
          <span className={styles.icon}><Trophy size={19} /></span>
          <div>
            <h2>Nível {level.level}</h2>
            <small className={styles.accent}>{level.rank}</small>
          </div>
        </div>
        <div className={styles.row}><strong>{level.xp.toLocaleString('pt-BR')} XP acumulados</strong><small>{level.toNext.toLocaleString('pt-BR')} XP para o próximo nível</small></div>
        <progress className={styles.progress} value={level.pct} max={100} aria-label="Progresso para o próximo nível" />
      </section>

      <section className={styles.card}>
        <h2><Brain size={17} /> Módulos ativos</h2>
        <ul className={styles.modules}>
          {activeModules.map(({ id, title, icon: Icon }) => <li key={id}><Icon size={15} />{title}</li>)}
        </ul>
        {!activeModules.length && <small>Nenhum módulo ativo.</small>}
      </section>

      <section className={styles.card}>
        <h2>Preferências</h2>
        <strong>Compartilhamento</strong>
        <button className={styles.button} type="button" aria-pressed={!!sharing.setting.data}
          disabled={!sharing.setting.isSuccess || sharing.change.isPending}
          onClick={() => sharing.change.mutate(!sharing.setting.data)}>Compartilhar rotinas e atividade</button>
        <small>Exibe rotinas, resumo dos treinos e média de hábitos. Publica conquistas de nível e dias completos para seguidores.</small>
        {(sharing.setting.isError || sharing.change.isError) && <p className={styles.error} role="alert">Não foi possível atualizar o compartilhamento.</p>}
        <strong>Aparência</strong>
        <div className={styles.themes} role="group" aria-label="Tema do aplicativo">
          <button type="button" className={styles.button} aria-pressed={theme === 'light'} disabled={update.isPending}
            onClick={() => update.mutate({ theme: 'light' })}><Sun size={17} /> Tema claro</button>
          <button type="button" className={styles.button} aria-pressed={theme === 'dark'} disabled={update.isPending}
            onClick={() => update.mutate({ theme: 'dark' })}><Moon size={17} /> Tema escuro</button>
        </div>
        <div className={styles.person}>
          <span className={styles.icon}><Globe2 size={17} /></span>
          <div><strong>Idioma e moeda</strong><small className={styles.locale}>{profile.language === 'pt-BR' ? 'Português (Brasil)' : profile.language} · {profile.currency}</small></div>
        </div>
      </section>

      {update.isError && <p className={styles.error} role="alert">Não foi possível salvar as alterações.</p>}
      <button type="button" onClick={signOut} className={`${styles.button} ${styles.accountAction}`}><LogOut size={16} /> Sair da conta</button>
      {signOutError && <p className={styles.error} role="alert">Não foi possível sair da conta.</p>}
      <button type="button" className={`${styles.button} ${styles.accountAction}`} onClick={() => { deleteAccount.reset(); setDeleteText('') }}>
        <Trash2 size={16} /> Excluir conta
      </button>
      {deleteText !== null && <Dialog title="Excluir sua conta?" busy={deleteAccount.isPending} onClose={() => setDeleteText(null)}>
        <p className={dialogStyles.description}>Sua conta, seus dados e suas fotos serão excluídos permanentemente.</p>
        <form className={styles.form} onSubmit={(event) => {
          event.preventDefault()
          if (deleteText === 'EXCLUIR' && !deleteAccount.isPending) deleteAccount.mutate()
        }}>
          <label>Digite EXCLUIR para confirmar
            <input value={deleteText} onChange={(event) => setDeleteText(event.currentTarget.value)} autoComplete="off" disabled={deleteAccount.isPending} />
          </label>
          {deleteAccount.isError && <p className={styles.error} role="alert">{deleteAccount.error.message}</p>}
          <div className={dialogStyles.actions}>
            <button type="button" className={dialogStyles.button} disabled={deleteAccount.isPending} onClick={() => setDeleteText(null)}>Cancelar</button>
            <button type="submit" className={dialogStyles.button + ' ' + dialogStyles.danger}
              disabled={deleteText !== 'EXCLUIR' || deleteAccount.isPending}>
              {deleteAccount.isPending ? 'Excluindo…' : 'Excluir permanentemente'}
            </button>
          </div>
        </form>
      </Dialog>}

      <OwnProfileFeed userId={profile.id} />
      </>}
    </div>
  )
}
