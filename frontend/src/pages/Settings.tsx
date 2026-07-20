import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { CompaniesPanel } from '@/components/settings/CompaniesPanel'
import { SystemPanel } from '@/components/settings/SystemPanel'
import { settingsApi } from '@/services/reportApi'
import { useAppStore } from '@/store/appStore'
import { useSettingsStore } from '@/store/settingsStore'
import type { AppLogEntry } from '@/types'

const LEVEL_COLOR: Record<string, string> = {
  INFO: 'text-blue-600',
  WARNING: 'text-amber-600',
  ERROR: 'text-red-600',
  CRITICAL: 'text-red-600',
}

type Tab = 'companies' | 'logs' | 'system'

export default function SettingsPage() {
  const { pushToast } = useAppStore()
  const { loaded, fetchSettings } = useSettingsStore()
  const [tab, setTab] = useState<Tab>('companies')
  const [logs, setLogs] = useState<AppLogEntry[]>([])
  const [logsLoaded, setLogsLoaded] = useState(false)

  useEffect(() => {
    if (!loaded) fetchSettings()
  }, [loaded])

  useEffect(() => {
    if (tab === 'logs' && !logsLoaded) {
      settingsApi.recentLogs(100)
        .then((data) => {
          setLogs(data)
          setLogsLoaded(true)
        })
        .catch((e) => pushToast(e.message || 'Failed to load logs', 'error'))
    }
  }, [tab, logsLoaded])

  return (
    <>
      <Topbar title="Settings" showNewInvoice={false} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-4 inline-flex rounded-md border border-gray-100 bg-white p-0.5">
          <button
            onClick={() => setTab('companies')}
            className={`rounded-[6px] px-3.5 py-1.5 text-[12px] font-medium transition ${tab === 'companies' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            Companies
          </button>
          <button
            onClick={() => setTab('logs')}
            className={`rounded-[6px] px-3.5 py-1.5 text-[12px] font-medium transition ${tab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            Logs
          </button>
          <button
            onClick={() => setTab('system')}
            className={`rounded-[6px] px-3.5 py-1.5 text-[12px] font-medium transition ${tab === 'system' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            System
          </button>
        </div>

        {tab === 'companies' && <CompaniesPanel />}
        {tab === 'system' && <SystemPanel />}

        {tab === 'logs' && (
          <div className="max-w-2xl rounded-lg border border-gray-100 bg-white p-4 shadow-card">
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Recent application logs
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-[12px] text-gray-300">No logs yet</div>
              ) : (
                logs.map((l) => (
                  <div key={l.id} className="border-b border-gray-50 py-1.5 text-[11px] last:border-0">
                    <span className={`font-semibold ${LEVEL_COLOR[l.level] || 'text-gray-700'}`}>[{l.level}]</span>{' '}
                    <span className="text-gray-300">{new Date(l.logged_at).toLocaleString('en-IN')}</span>{' '}
                    <span className="text-gray-700">{l.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
