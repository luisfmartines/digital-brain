import { Check, ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import Dialog from './Dialog'
import styles from './Dialog.module.css'

type Option<T> = { value: T; label: string }

export default function ChoiceField<T extends string | number>({ label, value, options, onChange, name, disabled, compactText, className }: {
  label: string; value: T; options: readonly Option<T>[]; onChange: (value: T) => void
  name?: string; disabled?: boolean; compactText?: ReactNode; className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)?.label
  const close = () => setOpen(false)

  return (
    <>
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      <button type="button" className={className ?? styles.trigger} aria-haspopup="dialog" aria-expanded={open}
        aria-label={selected ? label + ', ' + selected : label} disabled={disabled} onClick={() => setOpen(true)}>
        {compactText ?? <><span>{selected ?? 'Selecionar'}</span><ChevronDown size={16} aria-hidden="true" /></>}
      </button>
      {open && <Dialog title={label} onClose={close}>
        <div className={styles.options}>
          {options.map((option) => (
            <button type="button" key={option.value} className={styles.choice}
              aria-pressed={option.value === value} onClick={() => { close(); onChange(option.value) }}>
              {option.label}
              {option.value === value && <Check size={17} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Dialog>}
    </>
  )
}
