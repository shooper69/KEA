import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

export class KeaErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Kea] render crash', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="companion-screen settings-screen">
        <div className="settings-screen__content" style={{ justifyContent: 'center' }}>
          <section className="settings-card">
            <h2>Something went wrong</h2>
            <p className="settings-note">
              Kea hit a glitch. You are still signed in. Reset clears stuck
              listening and speech without logging you out.
            </p>
            <button
              type="button"
              className="kea-button settings-save"
              onClick={() => {
                try {
                  window.speechSynthesis?.cancel()
                } catch {
                  // ignore
                }
                window.location.assign(`${window.location.origin}/conversation`)
              }}
            >
              Reset Kea
            </button>
          </section>
        </div>
      </main>
    )
  }
}
