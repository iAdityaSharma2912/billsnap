import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Pencil } from 'lucide-react'
import { CompanyTabs } from '@/components/shared/CompanyTabs'
import { CustomerPicker, NewCustomerModal } from '@/components/invoice/CustomerPicker'
import { ItemsTable } from '@/components/invoice/ItemsTable'
import { TotalBox } from '@/components/invoice/TotalBox'
import { InvoicePreviewModal } from '@/components/invoice/InvoicePreviewModal'
import { useInvoiceStore } from '@/store/invoiceStore'
import { useAppStore } from '@/store/appStore'
import { useKeyboard } from '@/hooks/useKeyboard'
import { invoiceApi } from '@/services/invoiceApi'
import type { Customer, InvoiceDetail } from '@/types'

export function InvoiceForm() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const editId = params.id ? Number(params.id) : null
  const { activeCompany, pushToast } = useAppStore()
  const {
    company, customerId, customerName, customerPhone, customerAddress,
    paymentMode, remarks, items, editingInvoiceId, editingInvoiceNumber,
    setCompany, setCustomer, setRemarks, reset, grandTotal,
    loadFromInvoice,
  } = useInvoiceStore()

  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const [newCustomerSeed, setNewCustomerSeed] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingInvoice, setLoadingInvoice] = useState(!!editId)
  const [savedInvoice, setSavedInvoice] = useState<InvoiceDetail | null>(null)

  const isEditing = editingInvoiceId !== null

  // If we arrived via /invoice/:id/edit, load that invoice into the draft.
  // Otherwise (plain /invoice/new), make sure any leftover edit state from
  // a previous visit is cleared and default the company to whichever tab
  // is active elsewhere in the app.
  useEffect(() => {
    if (editId) {
      setLoadingInvoice(true)
      invoiceApi.get(editId)
        .then((invoice) => loadFromInvoice(invoice))
        .catch((e) => {
          pushToast(e.message || 'Failed to load invoice for editing', 'error')
          navigate('/invoices')
        })
        .finally(() => setLoadingInvoice(false))
    } else {
      reset()
      if (activeCompany) setCompany(activeCompany)
    }
  }, [editId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectCustomer(c: Customer) {
    setCustomer(c.id, c.name, c.phone, c.address ?? '')
  }

  function handleCreatedCustomer(c: Customer) {
    setCustomer(c.id, c.name, c.phone, c.address ?? '')
    setNewCustomerOpen(false)
    pushToast(`Customer "${c.name}" created`, 'success')
  }

  async function handleSave() {
    if (!customerId) {
      pushToast('Please select or create a customer first', 'error')
      return
    }
    if (items.length === 0) {
      pushToast('Add at least one line item', 'error')
      return
    }

    const itemPayload = items.map((it) => ({
      inventory_id: it.inventory_id ?? null,
      item_name: it.item_name,
      unit: it.unit,
      qty: it.qty,
      rate: it.rate,
    }))

    setSaving(true)
    try {
      if (isEditing && editingInvoiceId) {
        const invoice = await invoiceApi.update(editingInvoiceId, {
          customer_id: customerId,
          payment_mode: paymentMode,
          remarks: remarks || undefined,
          items: itemPayload,
        })
        pushToast(`Invoice ${invoice.invoice_number} updated · PDF regenerated`, 'success')
        setSavedInvoice(invoice)
      } else {
        const invoice = await invoiceApi.create({
          company,
          customer_id: customerId,
          payment_mode: paymentMode,
          remarks: remarks || undefined,
          items: itemPayload,
        })
        pushToast(`Invoice ${invoice.invoice_number} saved · PDF generated`, 'success')
        setSavedInvoice(invoice)
      }
    } catch (e: any) {
      pushToast(e.message || 'Failed to save invoice', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleDone() {
    setSavedInvoice(null)
    reset()
    if (savedInvoice) navigate(`/invoices?open=${savedInvoice.id}`)
  }

  useKeyboard({ 'ctrl+s': handleSave }, !savedInvoice)

  if (loadingInvoice) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-[13px] text-gray-300">Loading invoice...</span>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto px-5 py-4">
      {isEditing && (
        <div className="mb-3.5 flex items-center gap-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-2.5">
          <Pencil className="h-4 w-4 flex-shrink-0 text-amber-600" />
          <span className="text-[12px] text-amber-600">
            Editing invoice <span className="font-semibold">{editingInvoiceNumber}</span> — the
            invoice number and date stay the same; saving will regenerate the PDF and adjust stock
            for any changed quantities.
          </span>
        </div>
      )}

      <CompanyTabs value={company} onChange={setCompany} disabled={isEditing} />
      {isEditing && (
        <p className="mt-1.5 text-[11px] text-gray-300">
          Company can't be changed while editing — delete and recreate the invoice if it needs to
          move to a different company.
        </p>
      )}

      <div className="mt-3.5 rounded-lg border border-gray-100 bg-white p-4 shadow-card">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Invoice details
        </div>

        <div className="mb-3 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Customer</label>
            <CustomerPicker
              value={customerName}
              onSelect={handleSelectCustomer}
              onCreateNew={(name) => {
                setNewCustomerSeed(name)
                setNewCustomerOpen(true)
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Phone</label>
            <input
              value={customerPhone}
              readOnly
              placeholder="Auto-fills from customer"
              className="h-[34px] w-full rounded-md border border-gray-100 bg-gray-50 px-3 text-[13px] text-gray-700"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Customer address</label>
          <input
            value={customerAddress}
            readOnly
            placeholder="Auto-fills from customer"
            className="h-[34px] w-full rounded-md border border-gray-100 bg-gray-50 px-3 text-[13px] text-gray-700"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Remarks (optional)</label>
          <input
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-md border border-teal-100 bg-teal-50 px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-teal-600" />
          <span className="text-[11px] text-teal-600">
            UPI QR code &amp; bank details will be auto-printed at the bottom of this invoice
            (set once in Settings → Companies)
          </span>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-gray-100 bg-white p-4 shadow-card">
        <ItemsTable />
        <TotalBox total={grandTotal()} />
        <p className="mt-2 text-[11px] text-gray-300">
          New item names typed here are added to this company's inventory automatically (at zero
          stock) so they show up in autocomplete next time.
        </p>
      </div>

      <div className="mt-4 flex justify-end gap-2 pb-4">
        <button
          onClick={() => {
            reset()
            navigate(isEditing ? '/invoices' : '/')
          }}
          className="h-[34px] rounded-md border border-gray-100 px-4 text-[13px] text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-[34px] rounded-md bg-blue-600 px-4 text-[13px] font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
        >
          {saving
            ? 'Saving...'
            : isEditing
              ? 'Save changes & regenerate PDF  ⌃S'
              : 'Save & generate PDF  ⌃S'}
        </button>
      </div>

      <NewCustomerModal
        open={newCustomerOpen}
        initialName={newCustomerSeed}
        onClose={() => setNewCustomerOpen(false)}
        onCreated={handleCreatedCustomer}
      />

      <InvoicePreviewModal
        open={!!savedInvoice}
        invoiceId={savedInvoice?.id ?? null}
        invoiceNumber={savedInvoice?.invoice_number ?? ''}
        onClose={handleDone}
        onError={(msg) => pushToast(msg, 'error')}
      />
    </div>
  )
}
