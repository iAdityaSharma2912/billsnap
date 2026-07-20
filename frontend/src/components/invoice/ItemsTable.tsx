import { useState, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { useInvoiceStore } from '@/store/invoiceStore'
import { useDebounce } from '@/hooks/useSearch'
import { inventoryApi } from '@/services/inventoryApi'
import type { InventoryItem } from '@/types'
import { useEffect } from 'react'

interface DraftRow {
  item_name: string
  unit: string
  qty: string
  rate: string
  inventory_id?: number | null
}

const emptyRow: DraftRow = { item_name: '', unit: 'Pcs', qty: '1', rate: '0' }

export function ItemsTable() {
  const { company, items, addItem, updateItem, removeItem } = useInvoiceStore()
  const [draft, setDraft] = useState<DraftRow>({ ...emptyRow })
  const [suggestions, setSuggestions] = useState<InventoryItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debouncedName = useDebounce(draft.item_name, 150)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (debouncedName.trim().length < 1) {
      setSuggestions([])
      return
    }
    inventoryApi.search(company, debouncedName).then(setSuggestions).catch(() => setSuggestions([]))
  }, [debouncedName, company])

  function pickSuggestion(item: InventoryItem) {
    setDraft({
      item_name: item.item_name,
      unit: item.unit,
      qty: draft.qty || '1',
      rate: String(item.selling_price),
      inventory_id: item.id,
    })
    setShowSuggestions(false)
  }

  function commitRow() {
    const qty = parseFloat(draft.qty)
    const rate = parseFloat(draft.rate)
    if (!draft.item_name.trim() || isNaN(qty) || qty <= 0 || isNaN(rate) || rate < 0) return

    addItem({
      item_name: draft.item_name.trim(),
      unit: draft.unit || 'Pcs',
      qty,
      rate,
      inventory_id: draft.inventory_id ?? null,
    })
    setDraft({ ...emptyRow })
    setShowSuggestions(false)
    nameInputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRow()
    }
  }

  return (
    <div>
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Line items (Tab to move, Enter to add new row)
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-gray-100 text-left text-[11px] text-gray-500">
            <th className="w-[38%] py-2 font-medium">Item name</th>
            <th className="w-[12%] py-2 font-medium">Qty</th>
            <th className="w-[12%] py-2 font-medium">Unit</th>
            <th className="w-[17%] py-2 font-medium text-right">Rate (₹)</th>
            <th className="w-[17%] py-2 font-medium text-right">Amount (₹)</th>
            <th className="w-[4%] py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx} className="border-b border-gray-50">
              <td className="py-1.5">
                <input
                  value={it.item_name}
                  onChange={(e) => updateItem(idx, { item_name: e.target.value })}
                  className="w-full rounded border border-transparent px-1.5 py-1 text-[12px] hover:border-gray-100 focus:border-blue-400 focus:outline-none"
                />
              </td>
              <td className="py-1.5">
                <input
                  type="number"
                  value={it.qty}
                  onChange={(e) => updateItem(idx, { qty: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded border border-transparent px-1.5 py-1 text-[12px] hover:border-gray-100 focus:border-blue-400 focus:outline-none"
                />
              </td>
              <td className="py-1.5">
                <input
                  value={it.unit}
                  onChange={(e) => updateItem(idx, { unit: e.target.value })}
                  className="w-full rounded border border-transparent px-1.5 py-1 text-[12px] hover:border-gray-100 focus:border-blue-400 focus:outline-none"
                />
              </td>
              <td className="py-1.5">
                <input
                  type="number"
                  value={it.rate}
                  onChange={(e) => updateItem(idx, { rate: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded border border-transparent px-1.5 py-1 text-right text-[12px] hover:border-gray-100 focus:border-blue-400 focus:outline-none"
                />
              </td>
              <td className="mono-amount py-1.5 text-right font-medium text-gray-900">
                {(it.qty * it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-1.5 text-center">
                <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}

          {/* draft / add-new row */}
          <tr className="relative bg-blue-50/40">
            <td className="relative py-1.5">
              <input
                ref={nameInputRef}
                value={draft.item_name}
                placeholder='Type "rr" for autocomplete, or a new item name...'
                onChange={(e) => {
                  setDraft({ ...draft, item_name: e.target.value, inventory_id: null })
                  setShowSuggestions(true)
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="w-full rounded border border-blue-100 bg-white px-1.5 py-1 text-[12px] focus:border-blue-400 focus:outline-none"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 top-full z-10 mt-1 w-72 rounded-md border border-gray-100 bg-white shadow-xl">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onMouseDown={() => pickSuggestion(s)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] hover:bg-blue-50"
                    >
                      <span>{s.item_name}</span>
                      <span className="text-gray-300">
                        ₹{s.selling_price} · stock {s.current_stock}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </td>
            <td className="py-1.5">
              <input
                type="number"
                value={draft.qty}
                onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full rounded border border-blue-100 bg-white px-1.5 py-1 text-[12px] focus:border-blue-400 focus:outline-none"
              />
            </td>
            <td className="py-1.5">
              <input
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full rounded border border-blue-100 bg-white px-1.5 py-1 text-[12px] focus:border-blue-400 focus:outline-none"
              />
            </td>
            <td className="py-1.5">
              <input
                type="number"
                value={draft.rate}
                onChange={(e) => setDraft({ ...draft, rate: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full rounded border border-blue-100 bg-white px-1.5 py-1 text-right text-[12px] focus:border-blue-400 focus:outline-none"
              />
            </td>
            <td colSpan={2} className="py-1.5 text-center">
              <button onClick={commitRow} className="text-[11px] font-medium text-blue-600 hover:underline">
                + Add item (Enter)
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
