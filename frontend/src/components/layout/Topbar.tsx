import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { SearchInput } from '@/components/shared/SearchInput'
import { useAppStore } from '@/store/appStore'

interface TopbarProps {
  title: string
  showSearch?: boolean
  onSearch?: (q: string) => void
  actions?: ReactNode
  showNewInvoice?: boolean
}

export function Topbar({ title, showSearch, onSearch, actions, showNewInvoice = true }: TopbarProps) {
  const navigate = useNavigate()

  return (
    <header className="flex h-[50px] flex-shrink-0 items-center gap-4 border-b border-gray-100 bg-white px-5">
      <span className="flex-shrink-0 text-[15px] font-semibold text-gray-900">{title}</span>

      {showSearch && (
        <div className="max-w-xs flex-1">
          <SearchInput placeholder="Search anything... Ctrl+F" onSearch={(q) => onSearch?.(q)} />
        </div>
      )}

      <div className="flex flex-1 items-center justify-end gap-2">
        {actions}
        {showNewInvoice && (
          <button
            onClick={() => navigate('/invoice/new')}
            className="flex h-[34px] items-center gap-1.5 rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white transition hover:bg-blue-800"
          >
            <Plus className="h-4 w-4" /> New invoice
          </button>
        )}
      </div>
    </header>
  )
}

export function useTopbarToast() {
  return useAppStore((s) => s.pushToast)
}
