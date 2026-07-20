import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { DataTable } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { CompanyTabs } from '@/components/shared/CompanyTabs'
import { useCompanies } from '@/hooks/useCompanies'
import { inventoryApi } from '@/services/inventoryApi'
import { useAppStore } from '@/store/appStore'
import type { InventoryItem } from '@/types'

const CATEGORIES = ['LED', 'Fans', 'Wire', 'Fitting', 'General', 'Appliances']
const UNITS = ['Mtr', 'Pcs', 'Box', 'Roll', 'Kg']

const emptyForm = {
  item_name: '', category: 'General', unit: 'Pcs',
  selling_price: '', current_stock: '', min_stock: '', remarks: '',
}

export default function Inventory() {
  const { activeCompany, setActiveCompany, pushToast } = useAppStore()
  const { companies } = useCompanies()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingCompanyKey, setEditingCompanyKey] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  async function load(forCompany: string) {
    if (!forCompany) return
    setLoading(true)
    try {
      const params: any = { search: search || undefined }
      if (categoryFilter !== 'ALL') params.category = categoryFilter
      const data = await inventoryApi.list(forCompany, params)
      // Guard against race conditions: if the company tab changed while
      // this request was in flight, an older request's response could
      // resolve after a newer one and overwrite the correct data with the
      // wrong company's items. Only apply the result if it's still for
      // the company currently selected.
      if (forCompany === activeCompany) {
        setItems(data)
      }
    } catch (e: any) {
      if (forCompany === activeCompany) {
        pushToast(e.message || 'Failed to load inventory', 'error')
      }
    } finally {
      if (forCompany === activeCompany) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    // Clear immediately on company switch so the previous company's items
    // never stay visible (even briefly) under the new company's tab.
    setItems([])
    load(activeCompany)
  }, [search, categoryFilter, activeCompany])

  function openCreate() {
    setEditingId(null)
    setEditingCompanyKey(null)
    setForm({ ...emptyForm })
    setModalOpen(true)
  }

  function openEdit(item: InventoryItem) {
    setEditingId(item.id)
    setEditingCompanyKey(item.company_key)
    setForm({
      item_name: item.item_name,
      category: item.category,
      unit: item.unit,
      selling_price: String(item.selling_price),
      current_stock: String(item.current_stock),
      min_stock: String(item.min_stock),
      remarks: item.remarks || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.item_name.trim()) {
      pushToast('Item name is required', 'error')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await inventoryApi.update(editingId, {
          item_name: form.item_name.trim(),
          category: form.category,
          unit: form.unit,
          selling_price: parseFloat(form.selling_price) || 0,
          current_stock: parseFloat(form.current_stock) || 0,
          min_stock: parseFloat(form.min_stock) || 0,
          remarks: form.remarks || undefined,
        })
        pushToast('Item updated', 'success')
      } else {
        await inventoryApi.create({
          company_key: activeCompany,
          item_name: form.item_name.trim(),
          category: form.category,
          unit: form.unit,
          selling_price: parseFloat(form.selling_price) || 0,
          current_stock: parseFloat(form.current_stock) || 0,
          min_stock: parseFloat(form.min_stock) || 0,
          remarks: form.remarks || undefined,
        } as any)
        pushToast('Item added', 'success')
      }
      setModalOpen(false)
      load(activeCompany)
    } catch (e: any) {
      pushToast(e.message || 'Failed to save item', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Topbar
        title="Inventory"
        showSearch
        onSearch={setSearch}
        showNewInvoice={false}
        actions={
          <>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-[34px] rounded-md border border-gray-100 bg-white px-3 text-[12px] focus:border-blue-400 focus:outline-none"
            >
              <option value="ALL">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button onClick={openCreate} className="h-[34px] rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-800">
              + Add item
            </button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-3.5">
          <CompanyTabs value={activeCompany} onChange={setActiveCompany} />
        </div>

        <DataTable<InventoryItem>
          data={items}
          keyAccessor={(i) => i.id}
          onRowClick={openEdit}
          emptyMessage={loading ? 'Loading...' : 'No inventory items yet for this company'}
          rowClassName={(i) => (i.low_stock ? 'bg-red-50/50' : '')}
          columns={[
            { header: 'Item name', accessor: (i) => <span className="font-medium text-gray-900">{i.item_name}</span> },
            { header: 'Category', accessor: (i) => i.category },
            { header: 'Unit', accessor: (i) => i.unit },
            { header: 'Price', accessor: (i) => <span className="mono-amount">₹{i.selling_price.toLocaleString('en-IN')}</span>, align: 'right' },
            {
              header: 'Stock',
              accessor: (i) => (
                <span className={i.low_stock ? 'font-semibold text-red-600' : ''}>
                  {i.current_stock} {i.low_stock && '⚠'}
                </span>
              ),
              align: 'right',
            },
            { header: 'Min stock', accessor: (i) => i.min_stock, align: 'right' },
          ]}
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingId
            ? `Edit item — ${companies.find((c) => c.company_key === editingCompanyKey)?.company_name ?? editingCompanyKey}`
            : `Add inventory item — ${companies.find((c) => c.company_key === activeCompany)?.company_name ?? activeCompany}`
        }
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="h-[34px] rounded-md border border-gray-100 px-3.5 text-[13px] text-gray-700">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="h-[34px] rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add item'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Item name *</label>
            <input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Selling price (₹)</label>
              <input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Current stock</label>
              <input type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Min stock</label>
              <input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Remarks</label>
            <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none" />
          </div>
        </div>
      </Modal>
    </>
  )
}
