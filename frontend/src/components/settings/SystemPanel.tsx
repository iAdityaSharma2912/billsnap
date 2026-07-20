import { useEffect, useState } from 'react'
import { FolderOpen, Bell, Info } from 'lucide-react'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useAppStore } from '@/store/appStore'
import { getAppDataDir, openFolder, isTauri } from '@/services/tauriApi'

// Kept in sync by hand with package.json (frontend) / tauri.conf.json's
// package.version — there are only two version numbers in this project
// (the web app didn't have a "version" concept worth surfacing in the
// UI before), so a build-time injection step felt like more machinery
// than this single display string is worth right now.
const APP_VERSION = '1.0.0'

export function SystemPanel() {
  const { pushToast } = useAppStore()
  const { notificationsEnabled, setNotificationsEnabled } = usePreferencesStore()
  const [dataDir, setDataDir] = useState<string | null>(null)
  const [openingFolder, setOpeningFolder] = useState(false)

  useEffect(() => {
    getAppDataDir().then(setDataDir)
  }, [])

  async function handleOpenDataFolder() {
    if (!dataDir) return
    setOpeningFolder(true)
    try {
      await openFolder(dataDir)
    } catch (e: any) {
      pushToast(e.message || 'Could not open the folder', 'error')
    } finally {
      setOpeningFolder(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-gray-900">
          <Bell className="h-4 w-4 text-blue-600" /> Notifications
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-gray-600">
            Show a desktop notification when items run low on stock
          </span>
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
        </label>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-gray-900">
          <FolderOpen className="h-4 w-4 text-blue-600" /> App data
        </div>
        <p className="mb-2.5 text-[12px] text-gray-600">
          Your database, invoices, exports, and backups are stored here. You generally
          shouldn't need to touch these files directly, but it's useful for manual backups
          or troubleshooting.
        </p>
        {isTauri() ? (
          <>
            <div className="mb-2.5 break-all rounded-md bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
              {dataDir || 'Loading...'}
            </div>
            <button
              onClick={handleOpenDataFolder}
              disabled={!dataDir || openingFolder}
              className="flex h-[34px] items-center gap-1.5 rounded-md border border-gray-100 px-3.5 text-[13px] text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {openingFolder ? 'Opening...' : 'Open data folder'}
            </button>
          </>
        ) : (
          <p className="text-[11px] text-gray-300">
            Not available in this view — open the desktop app to see this.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-card">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-gray-900">
          <Info className="h-4 w-4 text-blue-600" /> About
        </div>
        <p className="text-[12px] text-gray-600">BillSnap version {APP_VERSION}</p>
        <p className="mt-1 text-[11px] text-gray-300">
          If the app ever fails to start, check the "startup-crash.log" file inside the
          "logs" folder above for details, or use the Logs tab if the app did start but
          something went wrong afterward.
        </p>
      </div>
    </div>
  )
}
