import { useLocation } from 'react-router-dom'

export default function AssistantPage() {
  const { state } = useLocation()
  return (
    <>
      <h1>AI Assistant</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>Coming soon.</p>
      {state?.prompt && <p>You asked: “{state.prompt}”</p>}
    </>
  )
}