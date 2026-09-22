import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider } from './context/SessionContext'
import { ConversationPage } from './pages/ConversationPage'
import { MemoryLibraryPage } from './pages/MemoryLibraryPage'
import { WelcomePage } from './pages/WelcomePage'

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/language" element={<Navigate to="/" replace />} />
          <Route path="/conversation" element={<ConversationPage />} />
          <Route path="/memory" element={<MemoryLibraryPage />} />
          <Route path="/admin/*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
