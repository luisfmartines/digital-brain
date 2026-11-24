import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/manrope'
import './styles/tokens.css'
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/playfair-display/wght-italic.css'
import App from './App'

createRoot(document.getElementById('root')!, {
  onUncaughtError(error) {
    document.getElementById('startup')?.setAttribute('data-failed', '')
    console.error('Digital Brain render failed', error)
  },
}).render(
  <StrictMode>
    <App />
  </StrictMode>
)