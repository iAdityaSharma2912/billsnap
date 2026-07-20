import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { settingsApi } from '@/services/reportApi'
import { Logo } from '@/components/shared/Logo'
import { useAppStore } from '@/store/appStore'
import { useSettingsStore } from '@/store/settingsStore'

const emptyForm = {
  company_key: '', company_name: '', address: '', phone: '', upi_id: '', bank_details: '',
}

/**
 * Shown once, the very first time BillSnap is opened on a fresh install —
 * before any company exists in the database. Unlike the "Add company"
 * modal in Settings (which assumes at least one company already exists
 * and the user is adding a second), this screen IS the gate: nothing else
 * in the app is reachable until it succeeds, because every other screen
 * (Dashboard, New Invoice, Inventory, Reports...) needs an activeCompany
 * to operate against.
 *
 * Re-uses the same POST /settings/companies/create endpoint and field
 * set as CompaniesPanel's "Add company" modal — same backend validation,
 * same data shape — just presented full-screen instead of in a popover,
 * since there's no underlying page to dim behind it yet.
 */
export function CompanySetup({ onDone }: { onDone: () => void }) {
  const { pushToast, setActiveCompany } = useAppStore()
  const { fetchSettings } = useSettingsStore()

  const [form, setForm] = useState({ ...emptyForm })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const key = form.company_key.trim().toUpperCase()
    const name = form.company_name.trim()

    if (!key || !name) {
      setError('Company key and company name are required.')
      return
    }

    setCreating(true)
    setError(null)
    try {
      const company = await settingsApi.createCompany({
        company_key: key,
        company_name: name,
        address: form.address,
        phone: form.phone,
        upi_id: form.upi_id || undefined,
        bank_details: form.bank_details || undefined,
      })
      await fetchSettings()
      setActiveCompany(company.company_key)
      pushToast(`${company.company_name} is set up — welcome to BillSnap!`, 'success')
      onDone()
    } catch (e: any) {
      setError(e.message || 'Could not create the company. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-[480px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-4 text-[20px] font-semibold text-gray-900">Welcome to BillSnap</h1>
          <p className="mt-1.5 text-[13px] text-gray-500">
            Let's set up your business. You can add more companies later from Settings.
          </p>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-card">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">
                Company key * <span className="text-gray-300">(short code, e.g. SA — used in invoice numbers)</span>
              </label>
              <input
                value={form.company_key}
                onChange={(e) => setForm({ ...form, company_key: e.target.value.toUpperCase() })}
                maxLength={10}
                placeholder="SA"
                autoFocus
                className="h-[36px] w-full rounded-md border border-gray-100 px-3 text-[13px] uppercase focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Company name *</label>
              <input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="Sharma Agency"
                className="h-[36px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Address</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                placeholder="Shop address, shown on invoices"
                className="w-full rounded-md border border-gray-100 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-[36px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">UPI ID (optional)</label>
              <input
                value={form.upi_id}
                onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
                placeholder="name@upi"
                className="h-[36px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Bank details (optional)</label>
              <textarea
                value={form.bank_details}
                onChange={(e) => setForm({ ...form, bank_details: e.target.value })}
                rows={2}
                placeholder="A/c name, number, IFSC, branch"
                className="w-full rounded-md border border-gray-100 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating}
            className="mt-4 flex h-[38px] w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 text-[13px] font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            <Building2 className="h-4 w-4" />
            {creating ? 'Setting up...' : 'Create company & continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
