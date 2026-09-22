import { Navigate } from 'react-router-dom'

/** Signed-in home is the conversation screen, not the marketing page. */
export function HomePage() {
  return <Navigate to="/conversation" replace />
}
