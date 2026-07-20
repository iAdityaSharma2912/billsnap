import { api } from './api'
import type { DailyReport, MonthlyReport, Settings, AppLogEntry } from '@/types'

const API_BASE = 'http://localhost:8000'

export const reportApi = {
  daily: (date: string) =>
    api.get<DailyReport>('/report/daily', { params: { date } }).then((r) => r.data),
  monthly: (month: string) =>
    api.get<MonthlyReport>('/report/monthly', { params: { month } }).then((r) => r.data),
}

export const exportApi = {
  excel: (params?: { company?: string; date_from?: string; date_to?: string }) =>
    api.post<{ path: string }>('/export/excel', null, { params }).then((r) => r.data),

  /** Direct URL to download a generated .xlsx export by its server-side path. */
  downloadUrl: (path: string) => `${API_BASE}/export/excel/download?path=${encodeURIComponent(path)}`,

  /**
   * Downloads the generated Excel file to the user's computer.
   *
   * Same cross-origin issue as invoice PDF and backup ZIP downloads: a
   * plain `<a href download>` doesn't trigger a save dialog across origins
   * (API on localhost:8000, frontend on localhost:1420). We fetch the
   * bytes ourselves and save them via a same-origin blob: URL instead.
   */
  download: async (path: string) => {
    const res = await fetch(exportApi.downloadUrl(path))
    if (!res.ok) throw new Error('Could not download the Excel file')
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = blobUrl
    a.download = path.split('/').pop() || 'export.xlsx'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  },
}

export const backupApi = {
  create: () => api.post<{ path: string }>('/backup/create').then((r) => r.data),
  list: () => api.get<{ backups: string[] }>('/backup/list').then((r) => r.data),

  /** Direct URL to download a backup ZIP by filename. */
  downloadUrl: (filename: string) => `${API_BASE}/backup/download/${encodeURIComponent(filename)}`,

  /**
   * Downloads a backup ZIP to the user's computer.
   *
   * Same issue as invoice PDF download: a plain `<a href download>` does
   * not reliably trigger a save dialog for a cross-origin URL (the API on
   * localhost:8000 vs the frontend on localhost:1420) — browsers only
   * honor the `download` attribute for same-origin links. We fetch the
   * bytes ourselves and save them via a same-origin blob: URL instead.
   */
  download: async (filename: string) => {
    const res = await fetch(backupApi.downloadUrl(filename))
    if (!res.ok) throw new Error('Could not download the backup file')
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  },

  /** Restores from a ZIP the user picked with a file input (browse + upload). */
  restore: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api
      .post<{ success: boolean; message?: string }>('/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
}

export const settingsApi = {
  list: () => api.get<Settings[]>('/settings/list').then((r) => r.data),
  get: (companyKey: string) => api.get<Settings>(`/settings/${companyKey}`).then((r) => r.data),
  update: (companyKey: string, data: Partial<Settings>) =>
    api.put<Settings>(`/settings/${companyKey}`, data).then((r) => r.data),
  recentLogs: (limit = 100) =>
    api.get<AppLogEntry[]>('/settings/logs/recent', { params: { limit } }).then((r) => r.data),

  /** Companies management — add or remove a company at runtime. */
  createCompany: (data: {
    company_key: string
    company_name: string
    address?: string
    phone?: string
    bank_details?: string
    upi_id?: string
    show_payment_block?: number
  }) => api.post<Settings>('/settings/companies/create', data).then((r) => r.data),

  deleteCompany: (companyKey: string) =>
    api.delete<{ success: boolean; message?: string }>(`/settings/companies/${companyKey}`).then((r) => r.data),
}
