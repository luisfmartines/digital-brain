import translations from './locales/translation-cache.json' with { type: 'json' }

const dictionary: Record<string, string> = Object.fromEntries(
  Object.entries(translations).map(([source, translated]) => [source.toLowerCase(), translated]),
)

// Fitness terminology that general-purpose translation can interpret literally.
const overrides: Record<string, string> = {
  back: 'Costas', chest: 'Peito', waist: 'Abdômen', shoulders: 'Ombros',
  barbell: 'Barra', dumbbell: 'Haltere', cable: 'Cabo', band: 'Elástico',
  'resistance band': 'Elástico de resistência', bodyweight: 'Peso corporal',
  'body weight': 'Peso corporal', assisted: 'Assistido', leverage: 'Máquina de alavanca',
  'leverage machine': 'Máquina de alavanca', 'smith machine': 'Máquina Smith',
  'stability ball': 'Bola suíça', 'medicine ball': 'Bola medicinal',
  'upper arms': 'Braços', 'lower arms': 'Antebraços', 'upper legs': 'Coxas', 'lower legs': 'Pernas',
  'erector spinae': 'Eretores da coluna', 'latissimus dorsi': 'Dorsal',
  'band underhand pulldown': 'Puxada com elástico e pegada supinada',
  'cable pulldown (pro lat bar)': 'Puxada na polia com barra Pro Lat',
  'barbell bench press': 'Supino reto com barra',
  'dumbbell bench press': 'Supino reto com halteres',
  'barbell seated bradford rocky press': 'Desenvolvimento Bradford sentado com barra',
  'upward facing dog': 'Postura do cachorro olhando para cima',
  'assisted hanging knee raise': 'Elevação de joelhos suspenso com assistência',
  'push-up inside leg kick': 'Flexão com chute da perna para dentro',
  'cable crossover': 'Crucifixo na polia (crossover)',
  'single-leg floor calf raise': 'Elevação unilateral de panturrilha no chão',
  'lower the heels at a measured pace before rising again; switch sides when the set calls for it.': 'Abaixe os calcanhares de forma controlada antes de subir novamente; troque de lado conforme a série.',
}

export const cleanInstruction = (text: string) => text.replace(/^Step\s*:\s*\d+\s*/i, '').trim()

export function translateText(text: string): string {
  const source = cleanInstruction(text)
  const key = source.toLowerCase()
  const translated = overrides[key] ?? dictionary[key]
  if (!translated) return source
  return translated
    .replace(/\bnúcleo\b/gi, 'abdômen')
    .replace(/\bbandas? de resistência\b/gi, 'elástico de resistência')
    .replace(/\bmosca\b/gi, 'crucifixo')
    .replace(/\bimprensa\b/gi, 'desenvolvimento')
    .replace(/\bdissimulado\b/gi, 'com pegada supinada')
}

export function translateExercise<T extends { name: string; equipment?: string | null }>(exercise: T): T {
  return { ...exercise, name: translateText(exercise.name), equipment: exercise.equipment?.split(', ').map(translateText).join(', ') ?? exercise.equipment }
}

export function originalSearchTerm(term: string): string | undefined {
  const folded = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const query = folded(term.trim())
  return Object.keys(dictionary).find((source) => folded(translateText(source)) === query)
}
