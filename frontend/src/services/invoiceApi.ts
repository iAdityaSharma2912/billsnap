import { api } from './api'
import type { Invoice, InvoiceDetail, InvoiceItemInput, Company } from '@/types'

export interface CreateInvoicePayload {
  company: Company
  customer_id: number
  invoice_date?: string
  payment_mode: string
  remarks?: string
  items: InvoiceItemInput[]
}

export interface UpdateInvoicePayload {
  customer_id: number
  payment_mode: string
  remarks?: string
  items: InvoiceItemInput[]
}

const API_BASE = 'http://localhost:8000'

export const invoiceApi = {
  list: (params?: { company?: string; date_from?: string; date_to?: string; customer_id?: number }) =>
    api.get<Invoice[]>('/invoice/list', { params }).then((r) => r.data),

  get: (id: number) =>
    api.get<InvoiceDetail>(`/invoice/${id}`).then((r) => r.data),

  create: (data: CreateInvoicePayload) =>
    api.post<InvoiceDetail>('/invoice/create', data).then((r) => r.data),

  /** Edits an existing invoice's customer, payment mode, remarks, and line
   * items. Company and date stay fixed; stock is reconciled automatically
   * on the backend. */
  update: (id: number, data: UpdateInvoicePayload) =>
    api.put<InvoiceDetail>(`/invoice/${id}`, data).then((r) => r.data),

  remove: (id: number) =>
    api.delete<{ success: boolean }>(`/invoice/${id}`).then((r) => r.data),

  pdfPath: (id: number) =>
    api.get<{ path: string }>(`/invoice/${id}/pdf`).then((r) => r.data),

  /** URL that forces a download (Content-Disposition: attachment). */
  pdfDownloadUrl: (id: number) => `${API_BASE}/invoice/${id}/pdf/file`,

  /** URL that displays inline in the browser's PDF viewer — used for print. */
  pdfViewUrl: (id: number) => `${API_BASE}/invoice/${id}/pdf/view`,

  /**
   * Downloads the invoice PDF to the user's computer.
   *
   * A plain `<a href="...cross-origin-url..." download>` does NOT reliably
   * trigger a save dialog — browsers only honor the `download` attribute
   * for same-origin links, and the API runs on a different port
   * (localhost:8000) than the frontend (localhost:1420). So instead we
   * fetch the bytes ourselves and save them via a blob: URL, which is
   * always same-origin and always triggers a real download.
   */
  downloadPdf: async (id: number, invoiceNumber: string) => {
    const res = await fetch(invoiceApi.pdfDownloadUrl(id))
    if (!res.ok) throw new Error('Could not download the PDF')
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `${invoiceNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  },

  /**
   * Prints the invoice PDF.
   *
   * `window.open(...)` plus a `load` listener is unreliable for PDFs:
   * when the browser's native PDF viewer handles the response, the popup
   * is a plugin/viewer rather than a normal document, and its `load`
   * event frequently never fires, so `print()` is never called and
   * nothing visibly happens. Instead, we load the PDF into a hidden
   * same-page <iframe> and call print() on its window once the PDF is
   * confirmed loaded (checked via a brief poll, since iframes loading
   * PDFs also don't always fire `onload` consistently across browsers).
   */
  printPdf: (id: number) => {
    const existing = document.getElementById('billsnap-print-frame')
    existing?.remove()

    const iframe = document.createElement('iframe')
    iframe.id = 'billsnap-print-frame'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    iframe.src = invoiceApi.pdfViewUrl(id)

    let printed = false
    const triggerPrint = () => {
      if (printed) return
      printed = true
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch {
        // Cross-origin or blocked — fall back to opening the PDF in a new
        // tab so the person can use the browser's own print button.
        window.open(invoiceApi.pdfViewUrl(id), '_blank')
      }
    }

    iframe.onload = () => setTimeout(triggerPrint, 300)
    document.body.appendChild(iframe)

    // Safety net: some browsers never fire onload for embedded PDFs.
    setTimeout(triggerPrint, 1500)
  },
}

