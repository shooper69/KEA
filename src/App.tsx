import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider } from './context/SessionContext'
import { AdminLayout } from './layouts/AdminLayout'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminVocabularyPage } from './pages/admin/AdminVocabularyPage'
import { ConversationPage } from './pages/ConversationPage'
import { WelcomePage } from './pages/WelcomePage'

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/language" element={<Navigate to="/" replace />} />
          <Route path="/conversation" element={<ConversationPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="vocabulary" element={<AdminVocabularyPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
