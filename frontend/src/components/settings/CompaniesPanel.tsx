import { useState } from 'react'
import { Plus, Building2, Trash2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { settingsApi } from '@/services/reportApi'
import { useAppStore } from '@/store/appStore'
import { useSettingsStore } from '@/store/settingsStore'
import type { Settings } from '@/types'

const emptyNewCompany = {
  company_key: '', company_name: '', address: '', phone: '', upi_id: '', bank_details: '',
}

const emptyEditForm = {
  company_name: '', address: '', phone: '', bank_details: '', upi_id: '', show_payment_block: 1,
}

export function CompaniesPanel() {
  const { pushToast } = useAppStore()
  const { settings, fetchSettings } = useSettingsStore()

  const [addOpen, setAddOpen] = useState(false)
  const [newCompany, setNewCompany] = useState({ ...emptyNewCompany })
  const [creating, setCreating] = useState(false)

  const [editing, setEditing] = useState<Settings | null>(null)
  const [editForm, setEditForm] = useState({ ...emptyEditForm })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function openAdd() {
    setNewCompany({ ...emptyNewCompany })
    setAddOpen(true)
  }

  async function handleCreate() {
    if (!newCompany.company_key.trim() || !newCompany.company_name.trim()) {
      pushToast('Company key and name are required', 'error')
      return
    }
    setCreating(true)
    try {
      await settingsApi.createCompany({
        company_key: newCompany.company_key.trim().toUpperCase(),
        company_name: newCompany.company_name.trim(),
        address: newCompany.address,
        phone: newCompany.phone,
        upi_id: newCompany.upi_id || undefined,
        bank_details: newCompany.bank_details || undefined,
      })
      pushToast(`Company "${newCompany.company_name}" added`, 'success')
      setAddOpen(false)
      fetchSettings()
    } catch (e: any) {
      pushToast(e.message || 'Failed to create company', 'error')
    } finally {
      setCreating(false)
    }
  }

  function openEdit(s: Settings) {
    setEditing(s)
    setEditForm({
      company_name: s.company_name,
      address: s.address,
      phone: s.phone,
      bank_details: s.bank_details || '',
      upi_id: s.upi_id || '',
      show_payment_block: s.show_payment_block,
    })
  }

  async function handleSaveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      await settingsApi.update(editing.company_key, editForm)
      pushToast('Company details saved', 'success')
      setEditing(null)
      fetchSettings()
    } catch (e: any) {
      pushToast(e.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    if (!confirm(`Delete "${editing.company_name}"? This only works if it has no invoices yet.`)) return
    setDeleting(true)
    try {
      await settingsApi.deleteCompany(editing.company_key)
      pushToast('Company deleted', 'success')
      setEditing(null)
      fetchSettings()
    } catch (e: any) {
      pushToast(e.message || 'Failed to delete company', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-3.5 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-gray-900">Companies</div>
          <p className="text-[12px] text-gray-500">
            Each company has its own invoices, inventory, and invoice numbering.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex h-[34px] items-center gap-1.5 rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-800"
        >
          <Plus className="h-4 w-4" /> Add company
        </button>
      </div>

      <div className="space-y-2">
        {settings.map((s) => (
          <button
            key={s.company_key}
            onClick={() => openEdit(s)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-white p-4 text-left shadow-card transition hover:border-blue-100"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-blue-50 p-2 text-blue-600">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-medium text-gray-900">{s.company_name}</div>
                <div className="text-[11px] text-gray-300">
                  {s.company_key} · {s.phone || 'No phone set'}
                </div>
              </div>
            </div>
            <span className="text-[11px] text-blue-600">Edit →</span>
          </button>
        ))}
      </div>

      {/* Add company modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a new company"
        footer={
          <>
            <button onClick={() => setAddOpen(false)} className="h-[34px] rounded-md border border-gray-100 px-3.5 text-[13px] text-gray-700">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={creating} className="h-[34px] rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white disabled:opacity-50">
              {creating ? 'Adding...' : 'Add company'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">
              Company key * <span className="text-gray-300">(short code, e.g. GS — used in invoice numbers)</span>
            </label>
            <input
              value={newCompany.company_key}
              onChange={(e) => setNewCompany({ ...newCompany, company_key: e.target.value.toUpperCase() })}
              maxLength={10}
              placeholder="GS"
              className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] uppercase focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Company name *</label>
            <input
              value={newCompany.company_name}
              onChange={(e) => setNewCompany({ ...newCompany, company_name: e.target.value })}
              placeholder="Gupta Stores"
              className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Address</label>
            <textarea
              value={newCompany.address}
              onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-gray-100 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Phone</label>
            <input
              value={newCompany.phone}
              onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })}
              className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">UPI ID (optional)</label>
            <input
              value={newCompany.upi_id}
              onChange={(e) => setNewCompany({ ...newCompany, upi_id: e.target.value })}
              placeholder="name@upi"
              className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Bank details (optional)</label>
            <textarea
              value={newCompany.bank_details}
              onChange={(e) => setNewCompany({ ...newCompany, bank_details: e.target.value })}
              rows={2}
              placeholder="A/c name, number, IFSC, branch"
              className="w-full rounded-md border border-gray-100 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* Edit company modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.company_name} (${editing.company_key})` : ''}
        footer={
          editing && (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex h-[34px] items-center gap-1.5 rounded-md border border-red-100 px-3.5 text-[13px] text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <span className="flex-1" />
              <button onClick={() => setEditing(null)} className="h-[34px] rounded-md border border-gray-100 px-3.5 text-[13px] text-gray-700">
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={saving} className="h-[34px] rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white disabled:opacity-50">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </>
          )
        }
      >
        {editing && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Company name</label>
              <input value={editForm.company_name} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Address</label>
              <textarea value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} rows={2} className="w-full rounded-md border border-gray-100 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Phone</label>
              <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none" />
            </div>

            <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Payment details</div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">UPI ID</label>
              <input value={editForm.upi_id} onChange={(e) => setEditForm({ ...editForm, upi_id: e.target.value })} placeholder="yourname@upi" className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Bank details</label>
              <textarea value={editForm.bank_details} onChange={(e) => setEditForm({ ...editForm, bank_details: e.target.value })} rows={2} placeholder="A/c name, number, IFSC, branch" className="w-full rounded-md border border-gray-100 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none" />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-gray-700">
              <input
                type="checkbox"
                checked={editForm.show_payment_block === 1}
                onChange={(e) => setEditForm({ ...editForm, show_payment_block: e.target.checked ? 1 : 0 })}
              />
              Show UPI QR & bank details on invoice PDFs
            </label>
          </div>
        )}
      </Modal>
    </div>
  )
}
