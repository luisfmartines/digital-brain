import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Mascot from './Mascot'
import { useMascotMood } from '../../features/assistant/useMascotMood'
import styles from './MascotFab.module.css'

const W = 96
const H = 58 // proporção do SVG (240 x 146)
const MARGIN = 8
const NAV_H = 68 // altura da barra inferior: o mascote não passa por cima dela
const DRAG_THRESHOLD = 6 // px de movimento para contar como arrasto (e não como clique)
const STORAGE_KEY = 'mascot-pos'

// true = ao soltar, o mascote gruda na borda esquerda/direita mais próxima (com efeito de mola)
const SNAP_TO_EDGE = false

interface Viewport { w: number; h: number; top: number; bottom: number }
interface Ratio { rx: number; ry: number }

function safeInset(side: 'top' | 'bottom') {
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;visibility:hidden;padding-${side}:env(safe-area-inset-${side},0px)`
  document.body.appendChild(probe)
  const v = parseFloat(getComputedStyle(probe).getPropertyValue(`padding-${side}`)) || 0
  probe.remove()
  return v
}

const readViewport = (): Viewport => ({
  w: window.innerWidth,
  h: window.innerHeight,
  top: safeInset('top'),
  bottom: safeInset('bottom'),
})

function bounds(v: Viewport) {
  const minX = MARGIN
  const minY = v.top + MARGIN
  return {
    minX,
    minY,
    maxX: Math.max(minX, v.w - W - MARGIN),
    maxY: Math.max(minY, v.h - H - NAV_H - v.bottom - MARGIN),
  }
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)

function loadRatio(): Ratio | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (typeof p?.rx === 'number' && typeof p?.ry === 'number') {
      return { rx: clamp(p.rx, 0, 1), ry: clamp(p.ry, 0, 1) }
    }
  } catch {
    /* localStorage indisponível: usa a posição padrão */
  }
  return null
}

interface Props {
  hidden?: boolean // ex.: teclado aberto
  lifted?: boolean // sobe a posição padrão para não ficar em cima do botão de treino
}

interface DragState {
  id: number
  sx: number
  sy: number
  ox: number
  oy: number
  x: number
  y: number
  lastX: number
  moved: boolean
  vp: Viewport
}

export default function MascotFab({ hidden = false, lifted = false }: Props) {
  const navigate = useNavigate()
  const { mood, celebrating } = useMascotMood()
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const tiltTimer = useRef<number | undefined>(undefined)
  const snapTimer = useRef<number | undefined>(undefined)

  const [vp, setVp] = useState<Viewport>(readViewport)
  const [ratio, setRatio] = useState<Ratio | null>(loadRatio)
  const [dragging, setDragging] = useState(false)
  const [landing, setLanding] = useState(false)

  useEffect(() => {
    const onResize = () => setVp(readViewport())
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      window.clearTimeout(tiltTimer.current)
      window.clearTimeout(snapTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!landing) return
    const t = window.setTimeout(() => setLanding(false), 450)
    return () => window.clearTimeout(t)
  }, [landing])

  const b = bounds(vp)
  const style: CSSProperties | undefined = ratio
    ? {
        left: b.minX + ratio.rx * (b.maxX - b.minX),
        top: b.minY + ratio.ry * (b.maxY - b.minY),
        right: 'auto',
        bottom: 'auto',
      }
    : undefined

  const openAssistant = () => navigate('/assistant')

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = ref.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    drag.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: rect.left,
      oy: rect.top,
      x: rect.left,
      y: rect.top,
      lastX: e.clientX,
      moved: false,
      vp: readViewport(),
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    const el = ref.current
    if (!d || !el || d.id !== e.pointerId) return

    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      d.moved = true
      setDragging(true)
      window.clearTimeout(snapTimer.current)
      el.style.transition = 'none'
    }

    const bb = bounds(d.vp)
    d.x = clamp(d.ox + dx, bb.minX, bb.maxX)
    d.y = clamp(d.oy + dy, bb.minY, bb.maxY)
    el.style.left = `${d.x}px`
    el.style.top = `${d.y}px`
    el.style.right = 'auto'
    el.style.bottom = 'auto'

    // inclina na direção do movimento e volta ao normal quando para
    const tilt = clamp((e.clientX - d.lastX) * 1.2, -16, 16)
    d.lastX = e.clientX
    el.style.setProperty('--tilt', `${tilt}deg`)
    window.clearTimeout(tiltTimer.current)
    tiltTimer.current = window.setTimeout(() => el.style.setProperty('--tilt', '0deg'), 90)
  }

  function finish(e: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const d = drag.current
    const el = ref.current
    if (!d || !el || d.id !== e.pointerId) return
    drag.current = null
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)

    if (!d.moved) {
      if (!cancelled) openAssistant() // toque simples = abrir a IA
      return
    }

    window.clearTimeout(tiltTimer.current)
    el.style.setProperty('--tilt', '0deg')
    setDragging(false)
    setLanding(true)

    const bb = bounds(d.vp)
    let x = d.x
    if (SNAP_TO_EDGE) {
      x = x + W / 2 < d.vp.w / 2 ? bb.minX : bb.maxX
      el.style.transition = 'left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
      el.style.left = `${x}px`
      snapTimer.current = window.setTimeout(() => {
        el.style.transition = ''
      }, 450)
    } else {
      el.style.transition = ''
    }

    const next: Ratio = {
      rx: bb.maxX === bb.minX ? 0 : (x - bb.minX) / (bb.maxX - bb.minX),
      ry: bb.maxY === bb.minY ? 0 : (d.y - bb.minY) / (bb.maxY - bb.minY),
    }
    setRatio(next)
    setVp(d.vp)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* sem persistência: a posição vale só nesta sessão */
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openAssistant()
    }
  }

  const cls = [
    styles.fab,
    lifted ? styles.lifted : '',
    dragging ? styles.dragging : '',
    hidden ? styles.hidden : '',
  ].join(' ')

  return (
    <div
      ref={ref}
      className={cls}
      style={style}
      role="button"
      tabIndex={0}
      aria-label="Assistente de IA"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Mascot mood={mood} dragging={dragging} landing={landing} celebrating={celebrating} />
    </div>
  )
}
