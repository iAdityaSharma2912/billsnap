import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Eye, Pencil } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { DataTable } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { InvoicePreviewModal } from '@/components/invoice/InvoicePreviewModal'
import { invoiceApi } from '@/services/invoiceApi'
import { useAppStore } from '@/store/appStore'
import { useCompanies } from '@/hooks/useCompanies'
import type { Invoice, InvoiceDetail } from '@/types'

const dateRangePresets = [
  { label: 'Today', days: 0 },
  { label: 'This week', days: 7 },
  { label: 'This month', days: 30 },
  { label: 'All time', days: null },
]

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function InvoiceHistory() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { pushToast } = useAppStore()
  const { companies, nameOf } = useCompanies()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [companyFilter, setCompanyFilter] = useState<string>('ALL')
  const [preset, setPreset] = useState('All time')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<InvoiceDetail | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const params: any = {}
      if (companyFilter !== 'ALL') params.company = companyFilter
      const presetCfg = dateRangePresets.find((p) => p.label === preset)
      if (presetCfg?.days !== null && presetCfg?.days !== undefined) {
        params.date_from = isoDaysAgo(presetCfg.days)
      }
      const data = await invoiceApi.list(params)
      setInvoices(data)
    } catch (e: any) {
      pushToast(e.message || 'Failed to load invoices', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [companyFilter, preset])

  useEffect(() => {
    const openId = searchParams.get('open')
    if (openId) {
      invoiceApi.get(Number(openId)).then(setDetail).catch(() => {})
    }
  }, [searchParams])

  async function openDetail(inv: Invoice) {
    try {
      const full = await invoiceApi.get(inv.id)
      setDetail(full)
    } catch (e: any) {
      pushToast(e.message || 'Failed to load invoice', 'error')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    try {
      await invoiceApi.remove(id)
      pushToast('Invoice deleted', 'success')
      setDetail(null)
      load()
    } catch (e: any) {
      pushToast(e.message || 'Failed to delete invoice', 'error')
    }
  }

  return (
    <>
      <Topbar title="Invoice history" />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-3.5 flex items-center gap-3">
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="h-[34px] rounded-md border border-gray-100 bg-white px-3 text-[12px] focus:border-blue-400 focus:outline-none"
          >
            <option value="ALL">All companies</option>
            {companies.map((c) => (
              <option key={c.company_key} value={c.company_key}>{c.company_name}</option>
            ))}
          </select>
          <div className="inline-flex rounded-md border border-gray-100 bg-white p-0.5">
            {dateRangePresets.map((p) => (
              <button
                key={p.label}
                onClick={() => setPreset(p.label)}
                className={`rounded-[6px] px-3 py-1.5 text-[12px] transition ${
                  preset === p.label ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable<Invoice>
          data={invoices}
          keyAccessor={(r) => r.id}
          onRowClick={openDetail}
          emptyMessage={loading ? 'Loading...' : 'No invoices found for this filter'}
          columns={[
            { header: 'Invoice #', accessor: (r) => <span className="font-medium text-blue-600">{r.invoice_number}</span> },
            { header: 'Customer', accessor: (r) => r.customer_name || '—' },
            { header: 'Date', accessor: (r) => r.invoice_date },
            { header: 'Company', accessor: (r) => nameOf(r.company) },
            { header: 'Amount', accessor: (r) => <span className="mono-amount">₹{r.grand_total.toLocaleString('en-IN')}</span>, align: 'right' },
            { header: 'Mode', accessor: (r) => r.payment_mode },
          ]}
        />
      </div>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.invoice_number ?? ''}
        width="600px"
        footer={
          detail && (
            <>
              <button
                onClick={() => handleDelete(detail.id)}
                className="h-[34px] rounded-md border border-red-100 px-3.5 text-[13px] text-red-600 hover:bg-red-50"
              >
                Delete invoice
              </button>
              <span className="flex-1" />
              <button
                onClick={() => navigate(`/invoice/${detail.id}/edit`)}
                className="flex h-[34px] items-center gap-1.5 rounded-md border border-gray-100 px-3.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={() => setPreviewOpen(true)}
                className="flex h-[34px] items-center gap-1.5 rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-800"
              >
                <Eye className="h-3.5 w-3.5" /> Preview PDF
              </button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-3 text-[13px]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-gray-300">Customer</div>
                <div className="font-medium text-gray-900">{detail.customer_name}</div>
                <div className="text-[12px] text-gray-500">{detail.customer_phone}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-300">Date / Mode</div>
                <div className="text-gray-900">{detail.invoice_date} · {detail.payment_mode}</div>
                <div className="text-[12px] text-gray-500">{nameOf(detail.company)}</div>
              </div>
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="py-1.5">Item</th>
                  <th className="py-1.5 text-right">Qty</th>
                  <th className="py-1.5 text-right">Rate</th>
                  <th className="py-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it) => (
                  <tr key={it.id} className="border-b border-gray-50">
                    <td className="py-1.5">{it.item_name}</td>
                    <td className="py-1.5 text-right">{it.qty} {it.unit}</td>
                    <td className="py-1.5 text-right">₹{it.rate.toLocaleString('en-IN')}</td>
                    <td className="mono-amount py-1.5 text-right font-medium">₹{it.amount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end">
              <div className="rounded-md bg-blue-50 px-4 py-2 text-right">
                <div className="text-[11px] text-blue-800">Grand total</div>
                <div className="mono-amount text-[18px] font-bold text-blue-900">
                  ₹{detail.grand_total.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
            {detail.pdf_path && (
              <div className="rounded-md bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
                PDF saved at: <span className="font-mono">{detail.pdf_path}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <InvoicePreviewModal
        open={previewOpen && !!detail}
        invoiceId={detail?.id ?? null}
        invoiceNumber={detail?.invoice_number ?? ''}
        onClose={() => setPreviewOpen(false)}
        onError={(msg) => pushToast(msg, 'error')}
      />
    </>
  )
}
