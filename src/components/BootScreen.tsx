import { clearSession } from '../lib/auth'
import { clearStoredData } from '../lib/storage'
import { BrandMark } from './BrandMark'

export function BootScreen({ error }: { error?: string }) {
  const reset = () => {
    if (!window.confirm('Reset the local Cadence data on this device? This cannot be undone.')) return
    clearSession()
    clearStoredData()
    window.location.reload()
  }

  return (
    <div className="boot-screen">
      <div className="boot-orb" aria-hidden="true" />
      <div className="boot-content">
        <BrandMark size="lg" />
        <div>
          <p className="boot-eyebrow">Cadence</p>
          <h1>{error ? 'A quiet moment.' : 'Preparing your workspace'}</h1>
          <p className="boot-copy">
            {error
              ? error
              : 'Everything stays on this device. We’re getting your local workspace ready.'}
          </p>
        </div>
        {error ? (
          <div className="boot-actions">
            <button className="button button-primary" onClick={() => window.location.reload()}>
              Try again
            </button>
            <button className="button button-quiet" onClick={reset}>
              Reset local data
            </button>
          </div>
        ) : (
          <div className="boot-progress" role="status" aria-label="Loading">
            <span />
          </div>
        )}
        <p className="boot-footnote">Offline by design · Stored locally</p>
      </div>
    </div>
  )
}
