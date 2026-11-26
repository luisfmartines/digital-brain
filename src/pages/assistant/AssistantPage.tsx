import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowUp, CalendarDays, CheckCircle2, Droplets, Dumbbell, ListChecks, Loader2, Undo2, Wallet, Zap,
} from 'lucide-react'
import Mascot from '../../components/mascot/Mascot'
import { useMascotMood } from '../../features/assistant/useMascotMood'
import { useProfile } from '../../features/profile/useProfile'
import {
  askNeural, refreshAppData, undoAction,
  type ChatMsg, type NeuralAction,
} from '../../features/assistant/neural'
import styles from './Assistant.module.css'

interface Bubble extends ChatMsg {
  id: number
  actions?: NeuralAction[]
  error?: boolean
}

const SUGGESTIONS = [
  'Gastei R$ 35 no Uber',
  'Reunião amanhã às 15h',
  'Bebi 500 ml de água',
  'Monte um treino de peito e tríceps',
]

const ICONS = {
  transaction: Wallet,
  event: CalendarDays,
  task: ListChecks,
  habit: Zap,
  water: Droplets,
  routine: Dumbbell,
} as const

function ActionCard({ action }: { action: NeuralAction }) {
  const qc = useQueryClient()
  const [state, setState] = useState<'idle' | 'busy' | 'undone' | 'error'>('idle')
  const Icon = ICONS[action.kind]

  async function undo() {
    if (!action.undo) return
    setState('busy')
    try {
      await undoAction(action.undo)
      refreshAppData(qc)
      setState('undone')
    } catch {
      setState('error')
    }
  }

  return (
    <div className={`${styles.card} ${state === 'undone' ? styles.cardUndone : ''}`}>
      <div className={styles.cardTop}>
        <span className={styles.cardIcon}><Icon size={20} /></span>
        <div className={styles.cardText}>
          <strong>{action.title}</strong>
          {action.subtitle && <span>{action.subtitle}</span>}
        </div>
        {action.amount && (
          <div className={styles.cardAmount}>
            <b className={action.amount.startsWith('+') ? styles.pos : styles.neg}>{action.amount}</b>
          </div>
        )}
      </div>
      <div className={styles.cardBottom}>
        <span className={styles.badge}>
          <CheckCircle2 size={13} /> {state === 'undone' ? 'Desfeito' : (action.badge ?? 'Feito')}
        </span>
        <div className={styles.cardBtns}>
          {action.link && state !== 'undone' && (
            <Link to={action.link} className={styles.cardBtn}>Ver</Link>
          )}
          {action.undo && state !== 'undone' && (
            <button type="button" className={styles.cardBtn} onClick={undo} disabled={state === 'busy'}>
              {state === 'busy' ? <Loader2 size={13} className={styles.spin} /> : <Undo2 size={13} />}
              {state === 'error' ? 'Tentar de novo' : 'Desfazer'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AssistantPage() {
  const { state, pathname } = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const { mood, celebrating } = useMascotMood()
  const firstName = (profile?.display_name ?? '').split(' ')[0]

  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const nextId = useRef(1)
  const endRef = useRef<HTMLDivElement>(null)
  const history = useRef<ChatMsg[]>([]) // só na memória da tela (sem histórico salvo)
  const sentInitial = useRef(false)

  const send = useCallback(async (raw: string) => {
    const content = raw.trim()
    if (!content || busy) return
    setText('')
    setBusy(true)
    history.current = [...history.current, { role: 'user' as const, text: content }].slice(-10)
    setBubbles((b) => [...b, { id: nextId.current++, role: 'user', text: content }])
    try {
      const res = await askNeural(history.current)
      // guarda um resumo do que foi feito para o Neural lembrar do contexto ("e ontem?")
      const summary = [res.reply, ...res.actions.map((a) => `[${a.title}${a.amount ? ' ' + a.amount : ''}]`)].join(' ')
      history.current = [...history.current, { role: 'assistant' as const, text: summary }].slice(-10)
      setBubbles((b) => [...b, { id: nextId.current++, role: 'assistant', text: res.reply, actions: res.actions }])
      if (res.actions.length) refreshAppData(qc)
    } catch (e) {
      history.current = history.current.slice(0, -1)
      setBubbles((b) => [...b, { id: nextId.current++, role: 'assistant', text: (e as Error).message, error: true }])
    } finally {
      setBusy(false)
    }
  }, [busy, qc])

  // Pergunta vinda da barra do Neural no início
  useEffect(() => {
    const prompt = (state as { prompt?: string } | null)?.prompt
    if (prompt && !sentInitial.current) {
      sentInitial.current = true
      navigate(pathname, { replace: true, state: null })
      void send(prompt)
    }
  }, [state, pathname, navigate, send])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [bubbles, busy])

  function submit(e: FormEvent) {
    e.preventDefault()
    void send(text)
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(text)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.mascot}>
          <Mascot mood={mood} celebrating={celebrating} />
        </div>
        <div className={styles.heroText}>
          <h1>Neural</h1>
          <p>Seu assistente de IA</p>
          <div className={styles.chips}>
            <span className={styles.chip}><i className={styles.dot} /> Conectado ao app</span>
            <span className={styles.chip}>Finanças</span>
            <span className={styles.chip}>Agenda</span>
            <span className={styles.chip}>Treinos</span>
          </div>
        </div>
      </header>

      <section className={styles.thread} aria-live="polite">
        {bubbles.length === 0 && (
          <div className={styles.empty}>
            <h2>Oi{firstName ? `, ${firstName}` : ''}! 👋</h2>
            <p>
              Me conte o que aconteceu e eu registro por você: gastos, compromissos, tarefas, hábitos,
              água e até montar um treino.
            </p>
          </div>
        )}

        {bubbles.map((b) =>
          b.role === 'user' ? (
            <div key={b.id} className={styles.userRow}>
              <div className={styles.userBubble}>{b.text}</div>
            </div>
          ) : (
            <div key={b.id} className={styles.aiRow}>
              <div className={styles.aiName}><Zap size={13} /> Neural</div>
              <div className={`${styles.aiBubble} ${b.error ? styles.aiError : ''}`}>
                <p>{b.text}</p>
                {b.actions?.map((a, i) => <ActionCard key={i} action={a} />)}
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className={styles.aiRow}>
            <div className={styles.aiName}><Zap size={13} /> Neural</div>
            <div className={`${styles.aiBubble} ${styles.typing}`}><i /><i /><i /></div>
          </div>
        )}
        <div ref={endRef} className={styles.end} />
      </section>

      <div className={styles.composerWrap}>
        <div className={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => send(s)} disabled={busy}>{s}</button>
          ))}
        </div>
        <form className={styles.composer} onSubmit={submit}>
          <textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder="Registre um gasto, tarefa ou hábito…"
            maxLength={1000}
            aria-label="Mensagem para o Neural"
          />
          <button type="submit" className={styles.sendBtn} disabled={busy || !text.trim()} aria-label="Enviar">
            {busy ? <Loader2 size={20} className={styles.spin} /> : <ArrowUp size={20} />}
          </button>
        </form>
        <p className={styles.hint}>Entende português do Brasil · Enter envia</p>
      </div>
    </div>
  )
}
