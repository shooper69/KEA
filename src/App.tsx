import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './context/SessionContext'
import { AdminOverview, AdminPage } from './pages/AdminPage'
import { AdminAboutPage } from './pages/AdminAboutPage'
import { AdminCostAnalysisPage } from './pages/AdminCostAnalysisPage'
import { AdminLeaveFunnelPage } from './pages/AdminLeaveFunnelPage'
import { AdminOffersPage } from './pages/AdminOffersPage'
import { AdminPlansPage } from './pages/AdminPlansPage'
import { AdminVoiceManagementPage } from './pages/AdminVoiceManagementPage'
import { AdminVoiceTesterPage } from './pages/AdminVoiceTesterPage'
import { AdminWebsiteTrackerPage } from './pages/AdminWebsiteTrackerPage'
import { AboutKeaPage } from './pages/AboutKeaPage'
import { ChatTopicsPage } from './pages/ChatTopicsPage'
import { ConversationPage } from './pages/ConversationPage'
import { LearnListPage } from './pages/LearnListPage'
import { SettingsPage } from './pages/SettingsPage'
import { WelcomePage } from './pages/WelcomePage'
import { HomePage } from './pages/HomePage'
import type { ReactNode } from 'react'
import { KeaPageMotion } from './components/companion/KeaPageMotion'
import { KeaSeo } from './components/companion/KeaSeo'
import { WebsiteTrackerProvider } from './components/websiteTracker/WebsiteTrackerProvider'
import { KeaErrorBoundary } from './components/companion/KeaErrorBoundary'

function RequireOnboard({ children }: { children: ReactNode }) {
  const { isOnboarded, authReady, cloudAuth, isSignedIn } = useSession()
  if (!authReady) return null
  if (cloudAuth && !isSignedIn) return <Navigate to="/" replace />
  if (!cloudAuth && !isOnboarded) return <Navigate to="/" replace />
  return children
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { authReady, isAdmin } = useSession()
  if (!authReady) return null
  if (!isAdmin) return <Navigate to="/conversation" replace />
  return children
}

function RequireSignedIn({ children }: { children: ReactNode }) {
  const { authReady, cloudAuth, isSignedIn, isOnboarded } = useSession()
  if (!authReady) return null
  if (cloudAuth && !isSignedIn) return <Navigate to="/" replace />
  if (!cloudAuth && !isOnboarded) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <WebsiteTrackerProvider />
        <KeaSeo />
        <KeaErrorBoundary>
        <KeaPageMotion>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route
            path="/home"
            element={
              <RequireSignedIn>
                <HomePage />
              </RequireSignedIn>
            }
          />
          <Route path="/language" element={<Navigate to="/" replace />} />
          <Route
            path="/conversation"
            element={
              <RequireOnboard>
                <ConversationPage />
              </RequireOnboard>
            }
          />
          <Route
            path="/learn"
            element={
              <RequireOnboard>
                <LearnListPage />
              </RequireOnboard>
            }
          />
          <Route
            path="/topics"
            element={
              <RequireOnboard>
                <ChatTopicsPage />
              </RequireOnboard>
            }
          />
          <Route path="/memory" element={<Navigate to="/learn" replace />} />
          <Route
            path="/about"
            element={
              <RequireOnboard>
                <AboutKeaPage />
              </RequireOnboard>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireOnboard>
                <SettingsPage />
              </RequireOnboard>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireOnboard>
                <RequireAdmin>
                  <AdminPage />
                </RequireAdmin>
              </RequireOnboard>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="about" element={<AdminAboutPage />} />
            <Route path="offers" element={<AdminOffersPage />} />
            <Route path="leave-funnel" element={<AdminLeaveFunnelPage />} />
            <Route path="voices" element={<AdminVoiceTesterPage />} />
            <Route
              path="voice-management"
              element={<AdminVoiceManagementPage />}
            />
            <Route path="tiers" element={<AdminPlansPage />} />
            <Route path="costs" element={<AdminCostAnalysisPage />} />
            <Route path="website-tracker" element={<AdminWebsiteTrackerPage />} />
          </Route>
        </Routes>
        </KeaPageMotion>
        </KeaErrorBoundary>
      </BrowserRouter>
    </SessionProvider>
  )
}
