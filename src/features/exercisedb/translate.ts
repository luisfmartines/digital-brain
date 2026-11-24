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
  'impossible dips': 'Mergulho impossível (tríceps)',
  'roller hip lat stretch': 'Alongamento de quadril e dorsais com rolo',
  'weighted sissy squat': 'Agachamento sissy com carga',
  'inverse leg curl (on pull-up cable machine)': 'Flexão inversa de joelhos na polia',
  'smith seated single-leg calf raise': 'Elevação unilateral de panturrilha sentado no Smith',
  'pull-up (neutral grip)': 'Barra fixa com pegada neutra',
  'bear crawl': 'Caminhada do urso',
  'isometric wipers': 'Abdominal para-brisa isométrico',
  'raise single arm push-up': 'Flexão com elevação de um braço',
  'weighted stretch lunge': 'Afundo alongado com carga',
  'machine lying leg curl': 'Flexão de joelhos deitado na máquina (mesa flexora)',
  'smith bent knee good morning': 'Bom dia no Smith com joelhos flexionados',
  'ez-bar standing french press': 'Tríceps francês em pé com barra W',
  'jack jump': 'Polichinelo',
  'push-up on lower arms': 'Flexão sobre os antebraços',
  'prone twist on stability ball': 'Rotação de tronco em decúbito ventral na bola suíça',
  'barbell upright row': 'Remada alta com barra',
  'smith upright row': 'Remada alta no Smith',
  'cable incline pushdown': 'Extensão de tríceps na polia com tronco inclinado',
  'dumbbell decline hammer press': 'Supino declinado com halteres e pegada neutra',
  'dumbbell single-arm shoulder press': 'Desenvolvimento unilateral com haltere',
  'machine narrow grip seated row': 'Remada sentada na máquina com pegada fechada',
  'inverted row': 'Remada invertida',
  'bicycle crunch': 'Abdominal bicicleta',
  'ez-bar spider curl': 'Rosca aranha com barra W',
  'machine single-arm shoulder press': 'Desenvolvimento unilateral na máquina',
  'hack calf raise': 'Elevação de panturrilha na máquina hack',
  'cable decline press': 'Supino declinado na polia',
  'dumbbell bench seated press': 'Desenvolvimento com halteres sentado no banco',
  'brace the torso and align the wrists with the forearms.': 'Contraia o tronco e alinhe os punhos com os antebraços.',
  'keep the wrists stacked and use a shoulder path that feels natural.': 'Mantenha os punhos alinhados e movimente os ombros em uma trajetória natural.',
  'curl the weight with your palms facing down, keeping the elbows close and torso still.': 'Eleve o peso flexionando os cotovelos, com as palmas para baixo, os cotovelos próximos ao corpo e o tronco imóvel.',
  'let the handle rise steadily until the arms are long, then reset the shoulders.': 'Deixe a alça subir de forma controlada até estender os braços; depois, reposicione os ombros.',
  'set the shoulders and upper arms before bending the elbows.': 'Estabilize os ombros e os braços antes de flexionar os cotovelos.',
  'lower the heels at a measured pace before rising again; switch sides when the set calls for it.': 'Abaixe os calcanhares de forma controlada antes de subir novamente; troque de lado conforme a série.',
}

export function translateName(name: string): string {
  if (!dictionary[name.toLowerCase()] && !overrides[name.toLowerCase()]) return name
  let result = translateText(name)
  const source = name.toLowerCase()
  const replace = (pattern: RegExp, text: string) => { result = result.replace(pattern, text) }
  if (/\brow\b/.test(source)) replace(/\b(linha|fileira|fila)\b/gi, 'remada')
  if (/\bcurl\b/.test(source)) replace(/\b(ondulação|onda|curvatura|cacho)\b/gi, 'rosca')
  if (/\bfly(es)?\b/.test(source)) replace(/\b(flyes|fly|mosca|voador|voar)\b/gi, 'crucifixo')
  if (/\bsmith\b/.test(source)) replace(/\bferreiro\b/gi, 'Smith')
  if (/\bsissy\b/.test(source)) replace(/\bmaricas\b/gi, 'sissy')
  if (/\bweighted\b/.test(source)) replace(/\bponderad[oa]s?\b/gi, 'com carga')
  if (/\bband\b/.test(source)) replace(/\bbanda\b/gi, 'elástico')
  if (/\bgrip\b/.test(source)) replace(/\b(aperto|punho)\b/gi, 'pegada')
  if (/\bcrunch\b/.test(source)) replace(/\b(trituração|crunch|esmagamento)\b/gi, 'abdominal')
  if (/\bpulldown\b/.test(source)) replace(/\bpulldown\b/gi, 'puxada')
  if (/\bdeadlift\b/.test(source)) replace(/\bdeadlift\b/gi, 'levantamento terra')
  if (/\bshoulder press\b/.test(source)) replace(/\b(supino|prensa|desenvolvimento) de ombro(s)?\b/gi, 'desenvolvimento')
  if (/\bez.bar\b/.test(source)) replace(/\bez-bar\b/gi, 'barra W')
  return result.charAt(0).toUpperCase() + result.slice(1)
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
  return { ...exercise, name: translateName(exercise.name), equipment: exercise.equipment?.split(', ').map(translateText).join(', ') ?? exercise.equipment }
}

export function originalSearchTerm(term: string): string | undefined {
  const folded = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const query = folded(term.trim())
  return Object.keys(dictionary).find((source) => folded(translateName(source)) === query)
}
