import { useState, type FormEvent } from 'react'
import { CalendarDays, Plus, Trophy, UsersRound } from 'lucide-react'
import Dialog from '../../components/ui/Dialog'
import { addDays, localDateStr, parseDate } from '../../lib/date'
import { useChallengeMembership, useChallenges, useCreateChallenge, type Challenge } from '../../features/social/challenges'
import styles from './Social.module.css'

const formatDate = (day: Date) => day.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
const challengeCalendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

function CreateChallenge({ close }: { close: () => void }) {
  const [id] = useState(() => crypto.randomUUID())
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const today = challengeCalendar.format(new Date())
  const [startsOn, setStartsOn] = useState(today)
  const [duration, setDuration] = useState('30')
  const create = useCreateChallenge()
  const days = Number(duration)
  const valid = name.trim().length >= 2 && !!startsOn && Number.isInteger(days) && days >= 1 && days <= 365

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || create.isPending) return
    create.mutate({ id, name: name.trim(), description: description.trim(), starts_on: startsOn, duration_days: days }, { onSuccess: close })
  }

  return (
    <Dialog title="Criar desafio" onClose={close} busy={create.isPending}>
      <form className={styles.form} onSubmit={submit}>
        <fieldset className={styles.fields} disabled={create.isPending}>
          <label>Nome do desafio<input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="30 dias em movimento" /></label>
          <label>Descrição<textarea rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <div className={styles.fieldRow}>
            <label>Data de início<input type="date" required min={today} max={localDateStr(addDays(parseDate(today), 365))} value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label>
            <label>Duração em dias<input type="number" required min={1} max={365} value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
          </div>
          <p className={styles.muted}>Cada dia com pelo menos um treino registrado conta uma vez.</p>
        </fieldset>
        {create.isError && <p className={styles.error} role="alert">{create.error.message}</p>}
        <button className={styles.primary} type="submit" disabled={create.isPending || !valid}>
          {create.isPending ? 'Criando…' : 'Criar desafio'}
        </button>
      </form>
    </Dialog>
  )
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const membership = useChallengeMembership(challenge.id)
  const range = formatDate(parseDate(challenge.starts_on)) + ' a ' + formatDate(addDays(parseDate(challenge.ends_on), -1))
  const progress = Math.min(challenge.active_days, challenge.duration_days)

  return (
    <li className={styles.challenge}>
      <Trophy size={21} aria-hidden="true" />
      <div className={styles.challengeInfo}>
        <div className={styles.challengeHeading}>
          <h2>{challenge.name}</h2>
          {challenge.closed ? <small>Encerrado</small> : challenge.is_creator ? <small>Criado por você</small>
            : challenge.joined && <small>Participando</small>}
        </div>
        {challenge.description && <p>{challenge.description}</p>}
        <div className={styles.challengeMeta}>
          <span><CalendarDays size={15} /> {range}</span>
          <span><UsersRound size={15} /> {challenge.participant_count} {challenge.participant_count === 1 ? 'participante' : 'participantes'}</span>
        </div>
        {challenge.joined && <div>
          <small>{progress} de {challenge.duration_days} {challenge.duration_days === 1 ? 'dia' : 'dias'} em movimento</small>
          <progress aria-label={'Progresso no desafio ' + challenge.name} max={challenge.duration_days} value={progress} />
        </div>}
        {!challenge.closed && !challenge.is_creator && <button type="button" className={challenge.joined ? styles.secondary : styles.primary}
          disabled={membership.isPending} onClick={() => membership.mutate(!challenge.joined)}>
          {challenge.joined ? 'Sair do desafio' : 'Entrar no desafio'}
        </button>}
        {membership.isError && <p role="alert" className={styles.error}>{membership.error.message}</p>}
      </div>
    </li>
  )
}

export default function ChallengesView() {
  const [creating, setCreating] = useState(false)
  const query = useChallenges()
  const challenges = query.data?.pages.flat() ?? []

  return (
    <section className={styles.stack}>
      <div className={styles.intro}><div><h1>Desafios</h1><p>Crie um desafio ou participe com outras pessoas.</p></div></div>
      {query.isPending && <p className={styles.empty} role="status">Carregando desafios…</p>}
      {query.isError && <p className={styles.error} role="alert">Não foi possível carregar os desafios. <button type="button" onClick={() => query.refetch()}>Tentar novamente</button></p>}
      {query.isSuccess && !challenges.length && <p className={styles.empty}>Ainda não há desafios. Crie o primeiro.</p>}
      {challenges.length > 0 && <ul className={styles.challengeList} aria-label="Desafios disponíveis">
        {challenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} />)}
      </ul>}
      {query.hasNextPage && <button type="button" className={styles.secondary} disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
        {query.isFetchingNextPage ? 'Carregando…' : 'Ver mais desafios'}
      </button>}
      <div className={styles.floatingActions}>
        <button type="button" className={styles.floatButton} aria-label="Criar desafio" title="Criar desafio" onClick={() => setCreating(true)}><Plus size={26} /></button>
      </div>
      {creating && <CreateChallenge close={() => setCreating(false)} />}
    </section>
  )
}
