import { useLocation } from 'react-router-dom'

export default function AssistantPage() {
  const { state } = useLocation()
  return (
    <>
      <h1>Assistente de IA</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>Em breve.</p>
      {state?.prompt && <p>Você perguntou: “{state.prompt}”</p>}
    </>
  )
}