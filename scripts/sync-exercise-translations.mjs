import { mkdir, readFile, writeFile } from 'node:fs/promises'

const dir = new URL('../src/features/exercisedb/locales/', import.meta.url)
await mkdir(dir, { recursive: true })
const cacheFile = new URL('translation-cache.json', dir)
let cache = {}
try { cache = JSON.parse(await readFile(cacheFile, 'utf8')) } catch { /* First run. */ }
const catalog = []
let after
if (process.argv.includes('--cached')) catalog.push(...JSON.parse(await readFile(new URL('catalog-source.json', dir), 'utf8')))
else {
do {
  const url = new URL('https://oss.exercisedb.dev/api/v1/exercises')
  url.searchParams.set('limit', '25')
  if (after) url.searchParams.set('after', after)
  let response
  for (let attempt = 0; attempt < 5; attempt++) {
    response = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (response.ok) break
    if (response.status !== 429 || attempt === 4) throw new Error(`Catalogue: ${response.status}`)
    await new Promise((resolve) => setTimeout(resolve, 10000 * (attempt + 1)))
  }
  const page = await response.json()
  catalog.push(...page.data)
  after = page.meta?.hasNextPage ? page.meta.nextCursor : null
  if (catalog.length % 250 === 0) console.log(`Catalogue: ${catalog.length}`)
  await new Promise((resolve) => setTimeout(resolve, 1100))
} while (after)
}

await writeFile(new URL('catalog-source.json', dir), JSON.stringify(catalog, null, 2) + '\n')
const clean = (text) => text.replace(/^Step\s*:\s*\d+\s*/i, '').trim()
const texts = [...new Set(catalog.flatMap((exercise) => [exercise.name, ...(exercise.instructions ?? []),
  ...(exercise.targetMuscles ?? []), ...(exercise.secondaryMuscles ?? []), ...(exercise.equipments ?? []),
  ...(exercise.bodyParts ?? []), ...(exercise.exerciseTips ?? []), ...(exercise.variations ?? []),
  ...(exercise.overview ? [exercise.overview] : []),
]).map(clean))]
console.log(`${catalog.length} exercises, ${texts.length} unique texts, ${texts.reduce((n, s) => n + s.length, 0)} characters`)
if (process.argv.includes('--inspect')) process.exit(0)

// Generate bundled translations once; the application never sends user data to
// this service and does not depend on a translation service at runtime.
let done = 0
const pending = texts.filter((source) => !cache[source])
const batches = []
let batch = []
for (const source of pending) {
  if (batch.join('\n').length + source.length > 3000 || batch.length >= 30) { batches.push(batch); batch = [] }
  batch.push(source)
}
if (batch.length) batches.push(batch)
async function translate(sources) {
  const source = sources.join('\n')
  const url = new URL('https://translate.googleapis.com/translate_a/single')
  for (const [key, value] of Object.entries({ client: 'gtx', sl: 'en', tl: 'pt', dt: 't', q: source })) url.searchParams.set(key, value)
  let translated
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw new Error(`Translation: ${response.status}`)
      const data = await response.json()
      translated = data[0].map((part) => part[0] ?? '').join('').trim()
      if (!translated) throw new Error('Empty translation')
      break
    } catch (error) {
      if (attempt === 3) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
  const lines = translated.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length !== sources.length) {
    if (sources.length === 1) cache[sources[0]] = translated
    else for (const text of sources) await translate([text])
  } else {
    sources.forEach((text, i) => { cache[text] = lines[i] })
  }
}
for (let i = 0; i < batches.length; i += 3) {
  await Promise.all(batches.slice(i, i + 3).map(translate))
  done += batches.slice(i, i + 3).flat().length
  await writeFile(cacheFile, JSON.stringify(cache, null, 2) + '\n')
  console.log(`Translated: ${Object.keys(cache).length}/${texts.length} (${done} new)`)
  await new Promise((resolve) => setTimeout(resolve, 300))
}
await writeFile(cacheFile, JSON.stringify(cache, null, 2) + '\n')
console.log('Translation complete')
