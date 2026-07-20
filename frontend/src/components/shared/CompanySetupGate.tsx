import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { CompanySetup } from '@/pages/CompanySetup'

/**
 * Wraps the entire routed application. On mount, loads the company list
 * once; while that's in flight, shows nothing (a blank frame for a few
 * hundred ms is preferable to a flash of the wrong screen). Once loaded:
 *
 *   - zero companies  -> render CompanySetup (first-run wizard), full-screen,
 *                        no sidebar, no routes reachable
 *   - 1+ companies    -> render the real app (children)
 *
 * This is the ONLY place in the app that needs to know about the
 * "fresh install, no company yet" state — every other screen can keep
 * assuming a company exists, because this gate guarantees one does by
 * the time they're ever rendered.
 */
export function CompanySetupGate({ children }: { children: React.ReactNode }) {
  const { settings, fetchSettings } = useSettingsStore()
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
      .then(() => setChecked(true))
      .catch((e) => {
        // Distinct from "zero companies" (a normal, expected state) —
        // this means the request itself failed even though
        // BackendReadyGate already confirmed /health responds, which
        // points to something more specific (e.g. a corrupted database
        // file) rather than "still starting up".
        setError(e?.message || 'Could not load company settings.')
        setChecked(true)
      })
  }, [])

  if (!checked) {
    return <div className="h-screen w-screen bg-page" />
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-page text-center">
        <p className="text-[13px] font-medium text-red-600">Couldn't load BillSnap</p>
        <p className="max-w-xs text-[12px] text-gray-500">{error}</p>
      </div>
    )
  }

  if (settings.length === 0) {
    return <CompanySetup onDone={() => { /* settingsStore already refreshed itself */ }} />
  }

  return <>{children}</>
}
