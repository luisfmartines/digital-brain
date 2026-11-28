import { useState, type CSSProperties } from 'react'
import { Activity, Bike, Dumbbell, Flame, Footprints, Gauge, PersonStanding, Repeat2, Search, Swords, Timer, Trophy, Waves, Zap, type LucideIcon } from 'lucide-react'
import Dialog from './Dialog'
import { ACTIVITIES, type ActivityCategory } from '../../features/workouts/activities'
import styles from './ActivityPicker.module.css'

const presentation: Partial<Record<ActivityCategory, [LucideIcon, string]>> = {
  CrossFit: [Flame, '#ec7542'], Hyrox: [Gauge, '#e86676'], 'Treino funcional': [Activity, '#40cabb'],
  HIIT: [Zap, '#f29e57'], Circuito: [Repeat2, '#e4508a'], Calistenia: [PersonStanding, '#e8bf56'],
  Musculação: [Dumbbell, '#b181f0'], Powerlifting: [Dumbbell, '#6798ee'], Strongman: [Trophy, '#3fbe92'],
  'Levantamento olímpico': [Dumbbell, '#ddad43'], Resistência: [Timer, '#47bdd2'], MetCon: [Timer, '#56a6d8'],
  Boxe: [Swords, '#eb729b'], 'Muay thai': [Swords, '#f4bf64'], MMA: [Swords, '#45c1a2'], 'Jiu-jitsu': [Swords, '#def374'],
  Corrida: [Footprints, '#d6ec66'], Caminhada: [Footprints, '#6cc075'], Ciclismo: [Bike, '#5fbade'],
  Natação: [Waves, '#6e9bfa'], Remo: [Waves, '#62c9b8'], Yoga: [PersonStanding, '#cf87df'],
}

const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim()

export default function ActivityPicker({ value, onSelect, onClose }: {
  value: ActivityCategory; onSelect: (category: ActivityCategory) => void; onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const match = normalize(search)
  const options = ACTIVITIES.filter((category) => normalize(category).includes(match))

  return (
    <Dialog title="Modalidades" onClose={onClose} className={styles.screen}>
      <label className={styles.search}><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar modalidade" placeholder="Buscar por nome" /></label>
      {options.length ? <div className={styles.grid}>
        {options.map((category) => {
          const [Icon, color] = presentation[category] ?? [Activity, '#a4bc75']
          return <button key={category} type="button" aria-pressed={category === value} onClick={() => onSelect(category)}>
            <span style={{ '--activity-tone': color } as CSSProperties}><Icon size={25} aria-hidden="true" /></span>
            {category}
          </button>
        })}
      </div> : <p role="status">Nenhuma modalidade encontrada.</p>}
    </Dialog>
  )
}
