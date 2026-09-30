import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './context/SessionContext'
import { AdminOverview, AdminPage } from './pages/AdminPage'
import { AdminCostAnalysisPage } from './pages/AdminCostAnalysisPage'
import { AdminLeaveFunnelPage } from './pages/AdminLeaveFunnelPage'
import { AdminOffersPage } from './pages/AdminOffersPage'
import { AdminHomePage } from './pages/AdminHomePage'
import { AdminOnboardingPage } from './pages/AdminOnboardingPage'
import { AdminPlansPage } from './pages/AdminPlansPage'
import { AdminStripePage } from './pages/AdminStripePage'
import { AdminManageKeaPage } from './pages/AdminManageKeaPage'
import { AdminWebsiteTrackerPage } from './pages/AdminWebsiteTrackerPage'
import { AboutKeaPage } from './pages/AboutKeaPage'
import { MethodPage } from './pages/MethodPage'
import { ChatTopicsPage } from './pages/ChatTopicsPage'
import { ConversationPage } from './pages/ConversationPage'
import { DeleteAccountPage } from './pages/DeleteAccountPage'
import { LearnListPage } from './pages/LearnListPage'
import { PerformancePage } from './pages/PerformancePage'
import { SettingsPage } from './pages/SettingsPage'
import { SubscriptionPage } from './pages/SubscriptionPage'
import { SupportPage } from './pages/SupportPage'
import { UsagePage } from './pages/UsagePage'
import {
  CookiePolicyPage,
  PrivacyPolicyPage,
  TermsOfServicePage,
} from './pages/LegalPages'
import { WelcomePage } from './pages/WelcomePage'
import { HomePage } from './pages/HomePage'
import type { ReactNode } from 'react'
import { KeaPageMotion } from './components/companion/KeaPageMotion'
import { KeaSeo } from './components/companion/KeaSeo'
import { CookieConsentBanner } from './components/companion/CookieConsentBanner'
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
        <CookieConsentBanner />
        <KeaErrorBoundary>
        <KeaPageMotion>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/method" element={<MethodPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          <Route path="/cookie-policy" element={<CookiePolicyPage />} />
          <Route path="/delete-account" element={<DeleteAccountPage />} />
          <Route path="/support" element={<SupportPage />} />
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
              <RequireAdmin>
                <ChatTopicsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/performance"
            element={
              <RequireOnboard>
                <PerformancePage />
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
            path="/subscription"
            element={
              <RequireOnboard>
                <SubscriptionPage />
              </RequireOnboard>
            }
          />
          <Route
            path="/usage"
            element={
              <RequireOnboard>
                <UsagePage />
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
            <Route path="manage-kea" element={<AdminManageKeaPage />} />
            <Route path="about" element={<Navigate to="/admin/manage-kea" replace />} />
            <Route path="home" element={<AdminHomePage />} />
            <Route path="offers" element={<AdminOffersPage />} />
            <Route path="onboarding" element={<AdminOnboardingPage />} />
            <Route path="leave-funnel" element={<AdminLeaveFunnelPage />} />
            <Route path="voices" element={<Navigate to="/admin/manage-kea" replace />} />
            <Route
              path="voice-management"
              element={<Navigate to="/admin/manage-kea" replace />}
            />
            <Route path="tiers" element={<AdminPlansPage />} />
            <Route path="stripe" element={<AdminStripePage />} />
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
