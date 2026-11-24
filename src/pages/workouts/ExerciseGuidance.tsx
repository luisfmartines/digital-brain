import { useState } from 'react'
import { Pause, Play } from 'lucide-react'
import type { ExerciseMedia } from '../../features/exercisedb/types'
import { cleanInstruction } from '../../features/exercisedb/translate'
import ExerciseImage from './ExerciseImage'
import styles from './exerciseDetail.module.css'

export function ExerciseDemo({ video, image, name, externalId, className = '' }: { video: string | null; image: string | null; name: string; externalId: string; className?: string }) {
  const [paused, setPaused] = useState(false)
  const [ref, setRef] = useState<HTMLVideoElement | null>(null)

  function toggle() {
    if (!ref) return
    if (ref.paused) { void ref.play(); setPaused(false) } else { ref.pause(); setPaused(true) }
  }
  return (
    <div className={styles.demo + ' ' + className}>
      {video ? (
        <>
          <video ref={setRef} src={video} poster={image ?? undefined} autoPlay loop muted playsInline aria-label={`Demonstração: ${name}`} />
          <button type="button" className={styles.pauseBtn} onClick={toggle} aria-label={paused ? 'Reproduzir' : 'Pausar'}>
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        </>
      ) : (
        <ExerciseImage key={externalId} src={image} externalId={externalId} name={name} />
      )}
    </div>
  )
}

export function ExerciseInstructions({ media, linked, loading, failed }: { media: ExerciseMedia | undefined; linked: boolean; loading: boolean; failed: boolean }) {
  if (!linked) return <p className={styles.empty}>Adicione a demonstração na aba Resumo para ver as instruções.</p>
  if (loading) return <p className={styles.empty}>Carregando…</p>
  if (failed || !media) return <p className={styles.empty}>Não foi possível carregar as instruções agora.</p>
  const none = !media.overview && media.instructions.length === 0 && media.tips.length === 0 && media.variations.length === 0
  return (
    <>
      {media.overview && <section className={styles.block}><h3>Visão geral</h3><p>{media.overview}</p></section>}
      {media.instructions.length > 0 && (
        <section className={styles.block}><h3>Como fazer</h3><ol className={styles.steps}>{media.instructions.map((t, i) => <li key={i}>{t}</li>)}</ol></section>
      )}
      {media.tips.length > 0 && (
        <section className={styles.block}><h3>Dicas</h3><ul className={styles.bullets}>{media.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></section>
      )}
      {media.variations.length > 0 && (
        <section className={styles.block}><h3>Variações</h3><ul className={styles.bullets}>{media.variations.map((t, i) => <li key={i}>{t}</li>)}</ul></section>
      )}
      {none && <p className={styles.empty}>Este exercício não tem instruções na base.</p>}
      <p className={styles.note}>Conteúdo da ExerciseDB traduzido automaticamente para português, com ajustes de terminologia.</p>
      {!!media.originalInstructions?.length && <details className={styles.block}><summary>Ver instruções originais em inglês</summary><ol className={styles.steps}>{media.originalInstructions.map((text, i) => <li key={i}>{cleanInstruction(text)}</li>)}</ol></details>}
    </>
  )
}
