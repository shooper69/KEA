import { useState } from 'react'
import { Link } from 'react-router-dom'
import { purgeKeaDeviceData } from '../../architecture/keaDevicePurge'
import { useSession } from '../../context/SessionContext'
import { deleteKeaCloudAccount } from '../../services/keaAccountDelete'

const CONFIRM_WORD = 'DELETE'

/**
 * Self-serve wipe for Play Store / GDPR: cloud account (cascaded rows) + this device.
 */
export function DeleteAccountPanel({
  showSettingsLink = false,
}: {
  showSettingsLink?: boolean
}) {
  const { isSignedIn, authReady, cloudAuth, signOut } = useSession()
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [deviceOnlyMessage, setDeviceOnlyMessage] = useState('')

  const confirmOk = confirmText.trim().toUpperCase() === CONFIRM_WORD

  async function deleteEverything() {
    if (!confirmOk || busy) return
    setBusy(true)
    setMessage('')
    try {
      if (cloudAuth && isSignedIn) {
        await deleteKeaCloudAccount()
      }
      try {
        await signOut()
      } catch {
        // ignore — cloud user may already be gone
      }
      purgeKeaDeviceData()
      window.location.assign('/')
    } catch (err) {
      setBusy(false)
      setMessage(
        err instanceof Error ? err.message : 'Could not delete your Kea data.',
      )
    }
  }

  function clearDeviceOnly() {
    if (busy) return
    purgeKeaDeviceData()
    setDeviceOnlyMessage(
      'Data stored on this device was cleared. Sign in again if you still have a Kea account.',
    )
  }

  if (!authReady) {
    return (
      <section className="settings-card">
        <h2>Delete my data</h2>
        <p className="settings-note">Checking your sign-in…</p>
      </section>
    )
  }

  return (
    <>
      <section className="settings-card">
        <h2>Delete my data</h2>
        <p className="settings-note">
          Kea may hold your account profile, Learn List, chat topics, usage
          stats, subscription references, and conversation text you chose to
          keep on this device. Deleting removes that data. This cannot be undone.
        </p>
        <ul className="settings-note delete-account__list">
          <li>Your Kea cloud account and sign-in</li>
          <li>Learn List, topics, and performance stats on Kea’s servers</li>
          <li>Conversation text and preferences stored on this device</li>
          <li>Active Kea subscription (cancelled when we delete the account)</li>
        </ul>
        {!cloudAuth || !isSignedIn ? (
          <p className="settings-note">
            Sign in with the Kea account you want to delete, then type{' '}
            <strong>{CONFIRM_WORD}</strong> below.
            {showSettingsLink ? (
              <>
                {' '}
                You can also open this from{' '}
                <Link to="/settings?tab=security">Settings → Security</Link>.
              </>
            ) : null}
          </p>
        ) : (
          <p className="settings-note">
            Type <strong>{CONFIRM_WORD}</strong> to confirm permanent deletion of
            your signed-in Kea account and data on this device.
          </p>
        )}
        <label className="welcome-field">
          <span>Confirmation</span>
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={CONFIRM_WORD}
            disabled={busy || (cloudAuth && !isSignedIn)}
          />
        </label>
        {message ? (
          <p className="settings-note delete-account__error">{message}</p>
        ) : null}
        <button
          type="button"
          className="kea-button kea-button--danger"
          disabled={busy || !confirmOk || (cloudAuth && !isSignedIn)}
          onClick={() => {
            void deleteEverything()
          }}
        >
          {busy ? 'Deleting…' : 'Delete all my Kea data'}
        </button>
        {cloudAuth && !isSignedIn ? (
          <p className="settings-note">
            <Link to="/">Sign in</Link> first, then return here to delete.
          </p>
        ) : null}
      </section>
      <section className="settings-card">
        <h2>This device only</h2>
        <p className="settings-note">
          Clear conversation text and preferences stored in this browser without
          deleting your Kea cloud account.
        </p>
        {deviceOnlyMessage ? (
          <p className="settings-note">{deviceOnlyMessage}</p>
        ) : null}
        <button
          type="button"
          className="kea-button kea-button--ghost"
          disabled={busy}
          onClick={clearDeviceOnly}
        >
          Clear data on this device
        </button>
      </section>
    </>
  )
}
