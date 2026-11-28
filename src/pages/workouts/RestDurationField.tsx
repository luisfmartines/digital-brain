import { useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Dialog from '../../components/ui/Dialog'
import { REST_OPTIONS, restLabel } from '../../features/workouts/setTypes'
import styles from './workouts.module.css'

function RestWheel({ seconds, onClose, onApply }: {
  seconds: number; onClose: () => void; onApply: (seconds: number) => void
}) {
  const wheel = useRef<HTMLDivElement>(null)
  const optionId = useId()
  const [index, setIndex] = useState(() => REST_OPTIONS.findIndex((option) => option.value === seconds))

  function select(next: number) {
    const list = wheel.current
    const option = list?.children[next] as HTMLElement | undefined
    if (list && option) list.scrollTop = next * option.offsetHeight
    setIndex(next)
  }

  useLayoutEffect(() => {
    const list = wheel.current
    // The dialog opens in an effect. Position the wheel once its rows have a layout.
    const frame = requestAnimationFrame(() => {
      const row = list?.firstElementChild
      if (list && row) list.scrollTop = REST_OPTIONS.findIndex((option) => option.value === seconds) * row.clientHeight
    })
    return () => cancelAnimationFrame(frame)
  }, [seconds])

  return (
    <Dialog title="Descanso entre séries" className={styles.restSheet} onClose={onClose}>
      <div className={styles.restWheelFrame}>
        <div ref={wheel} className={styles.restWheel} role="listbox" tabIndex={0}
          aria-label="Duração do descanso" aria-activedescendant={`${optionId}-${index}`}
          onScroll={(event) => {
            const list = event.currentTarget
            const height = list.firstElementChild?.clientHeight
            if (height) setIndex(Math.max(0, Math.min(REST_OPTIONS.length - 1, Math.round(list.scrollTop / height))))
          }}
          onKeyDown={(event) => {
            const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
            if (!step) return
            event.preventDefault()
            select(Math.max(0, Math.min(REST_OPTIONS.length - 1, index + step)))
          }}>
          {REST_OPTIONS.map((option, i) => (
            <div key={option.value} id={`${optionId}-${i}`} role="option" aria-selected={i === index}
              onClick={() => select(i)}>{option.label}</div>
          ))}
        </div>
      </div>
      <button type="button" className={styles.primary} onClick={() => onApply(REST_OPTIONS[index].value)}>Aplicar descanso</button>
    </Dialog>
  )
}

export default function RestDurationField({ seconds, onApply }: { seconds: number; onApply: (value: number) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.restDurationField}>
      <span>Descanso entre séries</span>
      <button type="button" className={styles.routineAction} aria-haspopup="dialog"
        aria-label={`Descanso entre séries, ${restLabel(seconds)}`} onClick={() => setOpen(true)}>
        {restLabel(seconds)} <ChevronDown size={14} />
      </button>
      {open && <RestWheel seconds={seconds} onClose={() => setOpen(false)} onApply={(value) => {
        onApply(value)
        setOpen(false)
      }} />}
    </div>
  )
}
