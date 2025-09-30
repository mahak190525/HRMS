import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MsalAuthProvider } from './hooks/MsalAuthProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MsalAuthProvider>
      <App />
    </MsalAuthProvider>
  </StrictMode>,
)
