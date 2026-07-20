import { useState } from 'react'
import { Download } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { exportApi } from '@/services/reportApi'
import { useAppStore } from '@/store/appStore'
import { useCompanies } from '@/hooks/useCompanies'
import { useKeyboard } from '@/hooks/useKeyboard'

export default function ExportPage() {
  const { pushToast } = useAppStore()
  const { companies } = useCompanies()
  const [company, setCompany] = useState<string>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [lastPath, setLastPath] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    try {
      const params: any = {}
      if (company !== 'ALL') params.company = company
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const result = await exportApi.excel(params)
      setLastPath(result.path)
      pushToast('Excel file generated — downloading now', 'success')
      await exportApi.download(result.path)
    } catch (e: any) {
      pushToast(e.message || 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  useKeyboard({ 'ctrl+e': handleExport }, true)

  return (
    <>
      <Topbar title="Export" showNewInvoice={false} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="max-w-md rounded-lg border border-gray-100 bg-white p-5 shadow-card">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Export invoices to Excel (.xlsx)
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Company</label>
              <select value={company} onChange={(e) => setCompany(e.target.value)} className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none">
                <option value="ALL">All companies</option>
                {companies.map((c) => (
                  <option key={c.company_key} value={c.company_key}>{c.company_name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500">From date</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500">To date</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none" />
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex h-[36px] w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-[13px] font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Generating...' : 'Export to Excel  ⌃E'}
            </button>
          </div>
          {lastPath && (
            <div className="mt-3 flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-[11px] text-green-600">
              <span>
                Saved to: <span className="font-mono">{lastPath}</span>
              </span>
              <button
                onClick={() => exportApi.download(lastPath).catch((e: any) => pushToast(e.message || 'Download failed', 'error'))}
                className="ml-3 flex-shrink-0 font-medium text-blue-600 hover:underline"
              >
                Download again
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
