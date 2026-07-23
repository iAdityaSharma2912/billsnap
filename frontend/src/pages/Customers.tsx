import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { DataTable } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { customerApi } from '@/services/customerApi'
import { invoiceApi } from '@/services/invoiceApi'
import { useAppStore } from '@/store/appStore'
import type { Customer, CustomerDetail, Invoice } from '@/types'

export default function Customers() {
  const { pushToast } = useAppStore()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // ── Add customer ────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Detail / view ───────────────────────────────────────────────────
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [detailInvoices, setDetailInvoices] = useState<Invoice[]>([])

  // ── Edit customer ───────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // ── Load list ────────────────────────────────────────────────────────
  async function load(q?: string) {
    setLoading(true)
    try {
      setCustomers(await customerApi.list(q))
    } catch (e: any) {
      pushToast(e.message || 'Failed to load customers', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(search) }, [search])

  // ── Create ────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!newName.trim()) { pushToast('Customer name is required', 'error'); return }
    setSaving(true)
    try {
      await customerApi.create({
        name: newName.trim(),
        phone: newPhone.trim(),   // optional
        address: newAddress,
      })
      pushToast('Customer added', 'success')
      setAddOpen(false)
      setNewName(''); setNewPhone(''); setNewAddress('')
      load(search)
    } catch (e: any) {
      pushToast(e.response?.data?.detail || e.message || 'Failed to create customer', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Open detail ────────────────────────────────────────────────────────
  async function openDetail(c: Customer) {
    try {
      const [full, invoices] = await Promise.all([
        customerApi.get(c.id),
        invoiceApi.list({ customer_id: c.id }),
      ])
      setDetail(full)
      setDetailInvoices(invoices)
    } catch (e: any) {
      pushToast(e.message || 'Failed to load customer', 'error')
    }
  }

  // ── Open edit (pre-fill from current detail) ────────────────────────
  function openEdit() {
    if (!detail) return
    setEditName(detail.name)
    setEditPhone(detail.phone || '')
    setEditAddress(detail.address || '')
    setEditError('')
    setEditOpen(true)
  }

  // ── Save edit ──────────────────────────────────────────────────────────
  async function handleEdit() {
    if (!detail || !editName.trim()) { setEditError('Customer name is required'); return }
    setEditSaving(true); setEditError('')
    try {
      const updated = await customerApi.update(detail.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress,
      })
      pushToast('Customer updated', 'success')
      setEditOpen(false)
      // Refresh the detail panel and list
      setDetail({ ...detail, ...updated })
      load(search)
    } catch (e: any) {
      setEditError(e.response?.data?.detail || e.message || 'Failed to update customer')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────
  async function handleDelete(id: number) {
    if (!confirm('Delete this customer? This cannot be undone.')) return
    try {
      await customerApi.remove(id)
      pushToast('Customer deleted', 'success')
      setDetail(null)
      load(search)
    } catch (e: any) {
      pushToast(e.response?.data?.detail || e.message || 'Failed to delete customer', 'error')
    }
  }

  return (
    <>
      <Topbar
        title="Customers"
        showSearch
        onSearch={setSearch}
        showNewInvoice={false}
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="h-[34px] rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-800"
          >
            + Add customer
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <DataTable<Customer>
          data={customers}
          keyAccessor={(c) => c.id}
          onRowClick={openDetail}
          emptyMessage={loading ? 'Loading...' : 'No customers yet'}
          columns={[
            { header: 'Name', accessor: (c) => <span className="font-medium text-gray-900">{c.name}</span> },
            { header: 'Phone', accessor: (c) => c.phone || <span className="text-gray-300">—</span> },
            { header: 'Address', accessor: (c) => c.address || <span className="text-gray-300">—</span> },
          ]}
        />
      </div>

      {/* ── Add customer modal ─────────────────────────────────────────── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add customer"
        footer={
          <>
            <button onClick={() => setAddOpen(false)} className="h-[34px] rounded-md border border-gray-100 px-3.5 text-[13px] text-gray-700">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={saving} className="h-[34px] rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white disabled:opacity-50">
              {saving ? 'Saving...' : 'Add customer'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Name *</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Phone <span className="text-gray-300">(optional)</span></label>
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Optional"
              className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Address</label>
            <textarea
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-100 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* ── Customer detail modal ──────────────────────────────────────── */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ''}
        width="560px"
        footer={
          detail && (
            <>
              <button
                onClick={() => handleDelete(detail.id)}
                className="h-[34px] rounded-md border border-red-100 px-3.5 text-[13px] text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
              <span className="flex-1" />
              <button
                onClick={openEdit}
                className="flex h-[34px] items-center gap-1.5 rounded-md border border-gray-100 px-3.5 text-[13px] text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => setDetail(null)}
                className="h-[34px] rounded-md bg-blue-600 px-4 text-[13px] font-medium text-white"
              >
                Close
              </button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-3 text-[13px]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-gray-300">Phone</div>
                <div className="text-gray-900">{detail.phone || <span className="text-gray-300">—</span>}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-300">Total purchases</div>
                <div className="mono-amount font-semibold text-gray-900">
                  ₹{detail.total_purchases.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
            {detail.address && (
              <div>
                <div className="text-[11px] text-gray-300">Address</div>
                <div className="text-gray-900">{detail.address}</div>
              </div>
            )}
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Purchase history ({detail.invoice_count})
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border border-gray-100">
                {detailInvoices.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[12px] text-gray-300">No invoices yet</div>
                ) : (
                  detailInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between border-b border-gray-50 px-3 py-2 text-[12px] last:border-0"
                    >
                      <span className="text-blue-600">{inv.invoice_number}</span>
                      <span className="text-gray-500">{inv.invoice_date}</span>
                      <span className="mono-amount font-medium">₹{inv.grand_total.toLocaleString('en-IN')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Edit customer modal ────────────────────────────────────────── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit customer"
        footer={
          <>
            <button
              onClick={() => setEditOpen(false)}
              className="h-[34px] rounded-md border border-gray-100 px-3.5 text-[13px] text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={editSaving}
              className="h-[34px] rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {editSaving ? 'Saving...' : 'Save changes'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {editError && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{editError}</div>
          )}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Name *</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">
              Phone <span className="text-gray-300">(optional)</span>
            </label>
            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="Optional"
              className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Address</label>
            <textarea
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-100 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </>
  )
}
