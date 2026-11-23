import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import styles from './Mascot.module.css'

export type MascotMood = 'neutro' | 'feliz' | 'triste' | 'abandonado'

interface Props {
  mood: MascotMood
  dragging?: boolean
  landing?: boolean
  celebrating?: boolean
}

// Piscar e olhar pros lados em intervalos aleatórios, para não parecer um loop mecânico
function useIdleLife(active: boolean) {
  const [blink, setBlink] = useState(false)
  const [look, setLook] = useState(0)

  useEffect(() => {
    if (!active) return
    let timer: number
    const loop = () => {
      timer = window.setTimeout(() => {
        setBlink(true)
        timer = window.setTimeout(() => {
          setBlink(false)
          setLook(Math.random() < 0.4 ? (Math.random() < 0.5 ? -1 : 1) : 0)
          loop()
        }, 140)
      }, 2000 + Math.random() * 4000)
    }
    loop()
    return () => window.clearTimeout(timer)
  }, [active])

  return { blink: active && blink, look: active ? look : 0 }
}

export default function Mascot({ mood, dragging = false, landing = false, celebrating = false }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const firstRun = useRef(true)
  const { blink, look } = useIdleLife(mood !== 'feliz')

  // "Pop" rápido sempre que o humor muda (os olhos fazem crossfade, o corpo dá um squash)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    svgRef.current?.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.12, 0.86)', offset: 0.3 },
        { transform: 'scale(0.96, 1.07)', offset: 0.65 },
        { transform: 'scale(1)' },
      ],
      { duration: 380, easing: 'ease-out' },
    )
  }, [mood])

  const cls = [
    styles.root,
    styles[mood],
    dragging ? styles.dragging : '',
    landing ? styles.landing : '',
    celebrating ? styles.celebrate : '',
  ].join(' ')

  return (
    <div className={cls} style={{ '--look': look } as CSSProperties}>
      <div className={styles.float}>
        <svg ref={svgRef} className={styles.svg} viewBox="0 0 240 146" aria-hidden="true" focusable="false">
          <g className={styles.body}>
            {/* corpo: nuvem/arbusto feita de formas sobrepostas, todas da mesma cor */}
            <g className={styles.fill}>
              <rect x="8" y="50" width="224" height="88" rx="36" />
              <circle cx="52" cy="62" r="42" />
              <circle cx="102" cy="44" r="38" />
              <circle cx="152" cy="40" r="36" />
              <circle cx="198" cy="60" r="34" />
            </g>

            <g className={styles.look}>
              <g className={`${styles.blinkable} ${blink ? styles.blink : ''}`}>
                {/* neutro */}
                <g className={`${styles.set} ${mood === 'neutro' ? styles.on : ''}`} fill="#fff">
                  <ellipse cx="95" cy="88" rx="10" ry="15" />
                  <ellipse cx="145" cy="88" rx="10" ry="15" />
                </g>

                {/* feliz: olhos em arco */}
                <g className={`${styles.set} ${mood === 'feliz' ? styles.on : ''}`} fill="#fff">
                  <path d="M82 95 A13 13 0 0 1 108 95 Z" />
                  <path d="M132 95 A13 13 0 0 1 158 95 Z" />
                </g>

                {/* triste: pálpebra caída + lágrima */}
                <g className={`${styles.set} ${mood === 'triste' ? styles.on : ''}`}>
                  <ellipse cx="95" cy="90" rx="10" ry="14" fill="#fff" />
                  <ellipse cx="145" cy="90" rx="10" ry="14" fill="#fff" />
                  <g className={styles.fill}>
                    <rect x="79" y="83" width="32" height="5" transform="rotate(-12 95 85)" />
                    <rect x="129" y="83" width="32" height="5" transform="rotate(12 145 85)" />
                  </g>
                  <path
                    className={styles.tear}
                    fill="#fff"
                    d="M145 106 C143 111 139 115 139 119 A6 6 0 0 0 151 119 C151 115 147 111 145 106 Z"
                  />
                </g>

                {/* abandonado: olhos rachados */}
                <g className={`${styles.set} ${mood === 'abandonado' ? styles.on : ''}`}>
                  <ellipse cx="95" cy="92" rx="8.5" ry="11.5" fill="#fff" />
                  <ellipse cx="145" cy="92" rx="8.5" ry="11.5" fill="#fff" />
                  <g className={styles.fillStroke} fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M96 81 L92 88 L98 91 L94 99" />
                    <path d="M146 81 L142 88 L148 91 L144 99" />
                  </g>
                </g>
              </g>
            </g>

            {/* abandonado: arranhões e poeira */}
            <g className={`${styles.set} ${mood === 'abandonado' ? styles.on : ''}`}>
              <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none">
                <path d="M30 34 L46 48" />
                <path d="M38 28 L56 44" />
                <path d="M24 42 L38 54" />
                <path d="M27 47 L52 36" />
              </g>
              <g fill="#fff">
                <circle className={styles.dust} cx="196" cy="110" r="2.6" />
                <circle className={styles.dust} cx="205" cy="105" r="2" style={{ animationDelay: '0.4s' }} />
                <circle className={styles.dust} cx="208" cy="115" r="1.6" style={{ animationDelay: '0.9s' }} />
                <circle className={styles.dust} cx="199" cy="119" r="1.8" style={{ animationDelay: '1.3s' }} />
                <circle className={styles.dust} cx="212" cy="108" r="1.4" style={{ animationDelay: '1.7s' }} />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  )
}
