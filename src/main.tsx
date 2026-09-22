import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { startKeaAnimationEngine } from './architecture/keaAnimationEngine'
import App from './App.tsx'
import './index.css'

startKeaAnimationEngine()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
