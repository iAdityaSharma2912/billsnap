import { Printer, Download, X } from 'lucide-react'
import { invoiceApi } from '@/services/invoiceApi'

interface InvoicePreviewModalProps {
  open: boolean
  invoiceId: number | null
  invoiceNumber: string
  onClose: () => void
  onError?: (message: string) => void
}

/**
 * Shows the actual generated invoice PDF inline (not just a "saved!"
 * message) so the person can see exactly what will print/download before
 * clicking either button. Uses an <iframe> pointed at the inline-view PDF
 * endpoint — every modern browser renders PDFs natively inside an iframe,
 * no extra library needed.
 */
export function InvoicePreviewModal({ open, invoiceId, invoiceNumber, onClose, onError }: InvoicePreviewModalProps) {
  if (!open || !invoiceId) return null

  function handleDownload() {
    invoiceApi.downloadPdf(invoiceId!, invoiceNumber).catch((e) => onError?.(e.message || 'Download failed'))
  }

  function handlePrint() {
    invoiceApi.printPdf(invoiceId!)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div
        className="flex h-full w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">Invoice preview</h3>
            <p className="text-[11px] text-gray-300">{invoiceNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex h-[34px] items-center gap-1.5 rounded-md border border-gray-100 px-3.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button
              onClick={handleDownload}
              className="flex h-[34px] items-center gap-1.5 rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-800"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
            <button onClick={onClose} className="rounded p-1.5 text-gray-300 hover:bg-gray-50 hover:text-gray-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-gray-50 p-3">
          <iframe
            key={invoiceId}
            src={invoiceApi.pdfViewUrl(invoiceId)}
            title={`Invoice ${invoiceNumber} preview`}
            className="h-full w-full rounded-md border border-gray-100 bg-white"
          />
        </div>
      </div>
    </div>
  )
}
