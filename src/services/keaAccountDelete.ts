import { keaAuthHeaders } from './keaAuthHeaders'

/** Delete the signed-in Kea cloud account (cascades Learn List, topics, stats, profile). */
export async function deleteKeaCloudAccount() {
  const response = await fetch('/api/account/delete', {
    method: 'POST',
    headers: await keaAuthHeaders(),
    body: JSON.stringify({ confirm: true }),
  })
  const data = (await response.json()) as { ok?: boolean; error?: string }
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? 'Could not delete your Kea data.')
  }
}
