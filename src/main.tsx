import './styles/fonts.generated.css'
import './styles/tokens.css'
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './bootstrap'

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
