import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Connections from './Connections'
import { useProfileSharing } from '../../features/social/sharedProfile'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Brain, Camera, Globe2, LogOut, Moon, Pencil, Sun, Trophy } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { MODULES } from '../../features/onboarding/modules'
import { levelInfo } from '../../features/profile/level'
import { useProfile } from '../../features/profile/useProfile'
import { useUploadAvatar } from '../../features/profile/useUploadAvatar'
import { supabase } from '../../lib/supabase'
import styles from './Profile.module.css'

export default function ProfilePage() {
  const [params] = useSearchParams()
  const connections = params.get('tab') === 'connections'
  const query = useProfile()
  const sharing = useProfileSharing()
  const profile = query.data
  const cache = useQueryClient()
  const avatar = useUploadAvatar()
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
      {connections ? <Connections /> : <>
      <section className={`${styles.card} ${styles.identity}`} aria-label="Dados do perfil">
        <div className={styles.row}>
          <div className={styles.person}>
            <Avatar url={profile.avatar_url} name={profile.display_name} size={56} ring />
            <div>
              <h2>{profile.display_name || 'Seu perfil'}</h2>
              {profile.username && <span className={styles.accent}>@{profile.username}</span>}
            </div>
          </div>
          {!editing && <button type="button" className={styles.button} onClick={() => { update.reset(); setEditing(true) }}><Pencil size={14} /> Editar</button>}
        </div>
        <label className={`${styles.button} ${styles.avatarUpload}`}>
          <Camera size={15} />
          {avatar.isPending ? 'Enviando foto…' : profile.avatar_url ? 'Trocar foto' : 'Adicionar foto'}
          <input aria-label={profile.avatar_url ? 'Trocar foto' : 'Adicionar foto'} type="file"
            accept="image/jpeg,image/png,image/webp" disabled={avatar.isPending}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0]
              e.currentTarget.value = ''
              if (file) avatar.mutate(file)
            }} />
        </label>
        {avatar.isError && <p className={styles.error} role="alert">{avatar.error.message}</p>}
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
          onClick={() => sharing.change.mutate(!sharing.setting.data)}>Compartilhar rotinas e média de hábitos</button>
        <small>Visíveis para outros usuários do Digital Brain ao abrir seu perfil.</small>
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
      <button type="button" onClick={signOut} className={`${styles.button} ${styles.signOut}`}><LogOut size={16} /> Sair da conta</button>
      {signOutError && <p className={styles.error} role="alert">Não foi possível sair da conta.</p>}
      </>}
    </div>
  )
}
