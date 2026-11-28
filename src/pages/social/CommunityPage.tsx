import { useState } from 'react'
import { ArrowLeft, Check, Link2, LogOut, Pencil, Trash2, UserPlus, UsersRound } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Avatar from '../../components/ui/Avatar'
import { useConfirmation } from '../../components/ui/useConfirmation'
import { useAuth } from '../../features/auth/useAuth'
import { memberCount, useCommunity, useCommunityMembers, useCommunityMembership, useDeleteCommunity } from '../../features/social/communities'
import type { Profile } from '../../features/social/queries'
import { publicAppOrigin, useDevice } from '../../expo/device'
import styles from './Social.module.css'

function Person({ profile, host }: { profile: Profile; host?: boolean }) {
  return (
    <Link className={styles.person} to={'/profiles/' + profile.id}>
      <Avatar url={profile.avatar_url} name={profile.display_name} size={40} />
      <span><strong>{profile.display_name || profile.username || 'Membro'}</strong>{profile.username && <small>@{profile.username}</small>}</span>
      {host && <small className={styles.host}>Fundador</small>}
    </Link>
  )
}

export default function CommunityPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const device = useDevice()
  const [shared, setShared] = useState('')
  const query = useCommunity(id)
  const community = query.data
  const members = useCommunityMembers(community?.id)
  const people = members.data?.pages.flat() ?? []
  const membership = useCommunityMembership(id)
  const remove = useDeleteCommunity()
  const confirmation = useConfirmation()
  const owned = community?.owner_id === user?.id

  async function invite() {
    if (!community) return
    setShared('')
    try {
      const link = new URL('/feed/communities/' + community.id, publicAppOrigin()).href
      if (device) await device.shareText('Conheça ' + community.name + ' no Hebbian.', link)
      else if (navigator.share) await navigator.share({ title: community.name, url: link })
      else { await navigator.clipboard.writeText(link); setShared('Link copiado.') }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setShared('Não foi possível compartilhar o link.')
    }
  }

  return (
    <main className={styles.standalone}>
      <header className={styles.pageHeader}>
        <Link to="/?tab=feed&section=communities" className={styles.iconButton} aria-label="Voltar às comunidades"><ArrowLeft size={20} /></Link>
        <h1>Comunidade</h1>
      </header>
      {query.isPending && <p role="status" className={styles.empty}>Carregando comunidade…</p>}
      {query.isError && <p role="alert" className={styles.error}>Não foi possível carregar a comunidade. <button type="button" onClick={() => query.refetch()}>Tentar novamente</button></p>}
      {query.isSuccess && !community && <p className={styles.empty}>Comunidade indisponível.</p>}
      {community && <>
        <section className={styles.communityHero}>
          <span className={styles.coverLarge}>{community.photo_url ? <img src={community.photo_url} alt="" /> : <UsersRound size={34} />}</span>
          <div><span className={styles.category}>{community.category}</span><h2>{community.name}</h2>
            <p>{memberCount(community)} {memberCount(community) === 1 ? 'membro' : 'membros'} · Pública</p>
          </div>
          {community.bio && <p className={styles.bio}>{community.bio}</p>}
          <div className={styles.communityActions}>
            {community.joined ? <span className={styles.memberStatus}><Check size={17} /> {owned ? 'Você criou esta comunidade' : 'Você faz parte'}</span>
              : <button type="button" className={styles.primary} disabled={membership.isPending} onClick={() => membership.mutate(true)}><UserPlus size={18} /> Entrar na comunidade</button>}
            <button type="button" className={styles.secondary} onClick={() => void invite()}><Link2 size={17} /> Convidar</button>
          </div>
          {shared && <small role="status">{shared}</small>}
          {membership.isError && <p role="alert" className={styles.error}>{membership.error.message}</p>}
        </section>
        {owned && <section className={styles.section} aria-label="Gerenciar comunidade">
          <h2>Gerenciar comunidade</h2>
          <Link className={styles.secondary} to={`/feed/communities/${community.id}/edit`}><Pencil size={16} /> Editar comunidade</Link>
          <button type="button" className={styles.leave} disabled={remove.isPending} onClick={() => confirmation.ask({
            title: 'Excluir comunidade?',
            description: 'A comunidade “' + community.name + '” será excluída para todos os membros.',
            danger: true,
            confirmLabel: 'Excluir comunidade',
            onConfirm: () => remove.mutate(community.id, {
              onSuccess: () => navigate('/?tab=feed&section=communities', { replace: true }),
            }),
          })}><Trash2 size={16} /> {remove.isPending ? 'Excluindo…' : 'Excluir comunidade'}</button>
          {remove.isError && <p className={styles.error} role="alert">{remove.error.message}</p>}
        </section>}
        {community.host && <section className={styles.section}><h2>Quem criou</h2><Person profile={community.host} host /></section>}
        <section className={styles.section}>
          <h2>Membros</h2>
          {members.isPending && <p role="status" className={styles.empty}>Carregando membros…</p>}
          {members.isError && <p role="alert" className={styles.error}>Não foi possível carregar os membros. <button type="button" onClick={() => members.refetch()}>Tentar novamente</button></p>}
          {people.length > 0 ? <ul className={styles.people}>{people.map((profile) => <li key={profile.id}><Person profile={profile} /></li>)}</ul>
            : members.isSuccess && <p className={styles.empty}>Ainda não há outros membros.</p>}
          {members.hasNextPage && people.length < memberCount(community) - 1 &&
            <button type="button" className={styles.secondary} disabled={members.isFetchingNextPage} onClick={() => members.fetchNextPage()}>
              {members.isFetchingNextPage ? 'Carregando…' : 'Ver mais membros'}
            </button>}
        </section>
        {community.joined && !owned && <button type="button" className={styles.leave} disabled={membership.isPending} onClick={() => confirmation.ask({
          title: 'Sair da comunidade?', description: 'Você poderá entrar novamente quando quiser.', danger: true,
          confirmLabel: 'Sair', onConfirm: () => membership.mutate(false),
        })}><LogOut size={17} /> Sair da comunidade</button>}
      </>}
      {confirmation.dialog}
    </main>
  )
}
