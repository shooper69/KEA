import { Navigate } from 'react-router-dom'

/** @deprecated Use AdminManageKeaPage — /admin/manage-kea */
export function AdminVoiceManagementPage() {
  return <Navigate to="/admin/manage-kea" replace />
}
