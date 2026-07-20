import { useEffect, useRef, useState } from 'react'
import { Shield, RotateCcw, Download, Upload } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { backupApi } from '@/services/reportApi'
import { useAppStore } from '@/store/appStore'
import { useKeyboard } from '@/hooks/useKeyboard'

export default function Backup() {
  const { pushToast } = useAppStore()
  const [backups, setBackups] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    try {
      const r = await backupApi.list()
      setBackups(r.backups)
    } catch (e: any) {
      pushToast(e.message || 'Failed to load backups', 'error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate() {
    setCreating(true)
    try {
      const r = await backupApi.create()
      const filename = r.path.split('/').pop()!
      pushToast('Backup created — downloading now', 'success')
      await backupApi.download(filename)
      load()
    } catch (e: any) {
      pushToast(e.message || 'Backup failed', 'error')
    } finally {
      setCreating(false)
    }
  }

  function handleBrowseClick() {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm(`Restore from "${file.name}"? Current data will be overwritten.`)) {
      e.target.value = ''
      return
    }

    setRestoring(true)
    try {
      await backupApi.restore(file)
      pushToast('Backup restored successfully. Please restart the app.', 'success')
    } catch (err: any) {
      pushToast(err.message || 'Restore failed', 'error')
    } finally {
      setRestoring(false)
      e.target.value = ''
    }
  }

  useKeyboard({ 'ctrl+b': handleCreate }, true)

  return (
    <>
      <Topbar title="Backup & restore" showNewInvoice={false} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-4 max-w-md rounded-lg border border-gray-100 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <div className="text-[13px] font-semibold text-gray-900">Create backup now</div>
          </div>
          <p className="mb-3 text-[12px] text-gray-500">
            Bundles the database, all invoice PDFs, exports, and settings into a single ZIP file
            and downloads it to your computer.
          </p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex h-[36px] w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-[13px] font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {creating ? 'Creating backup...' : 'Create & download backup  ⌃B'}
          </button>
        </div>

        <div className="mb-4 max-w-md rounded-lg border border-gray-100 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            <div className="text-[13px] font-semibold text-gray-900">Restore from a backup file</div>
          </div>
          <p className="mb-3 text-[12px] text-gray-500">
            Browse to a previously downloaded BillSnap-Backup-*.zip file on your computer to
            restore from it. This overwrites current data.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileSelected}
          />
          <button
            onClick={handleBrowseClick}
            disabled={restoring}
            className="flex h-[36px] w-full items-center justify-center gap-2 rounded-md border border-gray-100 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {restoring ? 'Restoring...' : 'Browse & restore ZIP file'}
          </button>
        </div>

        <div className="max-w-md rounded-lg border border-gray-100 bg-white p-5 shadow-card">
          <div className="mb-3 text-[13px] font-semibold text-gray-900">Backups on this PC</div>
          {backups.length === 0 ? (
            <div className="text-[12px] text-gray-300">No backups yet</div>
          ) : (
            <div className="space-y-1.5">
              {backups.map((b) => (
                <div key={b} className="flex items-center justify-between rounded-md border border-gray-50 px-3 py-2">
                  <span className="font-mono text-[12px] text-gray-700">{b}</span>
                  <button
                    onClick={() => backupApi.download(b).catch((e: any) => pushToast(e.message || 'Download failed', 'error'))}
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                  >
                    <Download className="h-3 w-3" /> Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
