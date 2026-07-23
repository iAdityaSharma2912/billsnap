import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { useDebounce } from '@/hooks/useSearch'
import { customerApi } from '@/services/customerApi'
import { Modal } from '@/components/shared/Modal'
import type { Customer } from '@/types'

interface CustomerPickerProps {
  value: string
  onSelect: (customer: Customer) => void
  onCreateNew: (name: string) => void
}

export function CustomerPicker({ value, onSelect, onCreateNew }: CustomerPickerProps) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<Customer[]>([])
  const [open, setOpen] = useState(false)
  const debounced = useDebounce(query, 150)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => setQuery(value), [value])

  useEffect(() => {
    if (debounced.trim().length < 1) { setResults([]); return }
    customerApi.list(debounced).then(setResults).catch(() => setResults([]))
  }, [debounced])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-gray-300" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search customer by name or phone..."
          className="h-[34px] w-full rounded-md border border-gray-100 bg-white pl-8 pr-3 text-[13px] outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        />
      </div>
      {open && query.trim().length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-gray-100 bg-white shadow-xl">
          {results.map((c) => (
            <button
              key={c.id}
              onMouseDown={() => { onSelect(c); setOpen(false) }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] hover:bg-blue-50"
            >
              <span className="font-medium text-gray-900">{c.name}</span>
              <span className="text-gray-300">{c.phone || '—'}</span>
            </button>
          ))}
          <button
            onMouseDown={() => { onCreateNew(query); setOpen(false) }}
            className="flex w-full items-center gap-1.5 border-t border-gray-50 px-3 py-2 text-left text-[12px] text-blue-600 hover:bg-blue-50"
          >
            + Create new customer "{query}"
          </button>
        </div>
      )}
    </div>
  )
}

interface NewCustomerModalProps {
  open: boolean
  initialName: string
  onClose: () => void
  onCreated: (customer: Customer) => void
}

export function NewCustomerModal({ open, initialName, onClose, onCreated }: NewCustomerModalProps) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { setName(initialName); setPhone(''); setAddress(''); setError('') }
  }, [open, initialName])

  async function handleSave() {
    if (!name.trim()) { setError('Customer name is required'); return }
    setSaving(true); setError('')
    try {
      const customer = await customerApi.create({
        name: name.trim(),
        phone: phone.trim(),   // phone is now optional — empty string is fine
        address,
      })
      onCreated(customer)
    } catch (e: any) {
      // Surface the actual backend error message, not just "Network Error"
      setError(e.response?.data?.detail || e.message || 'Failed to create customer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New customer"
      footer={
        <>
          <button onClick={onClose} className="h-[34px] rounded-md border border-gray-100 px-3.5 text-[13px] text-gray-700">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-[34px] rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Create customer'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</div>}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
            className="h-[34px] w-full rounded-md border border-gray-100 px-3 text-[13px] focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-100 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  )
}
