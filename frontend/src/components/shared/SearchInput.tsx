import { useState, useEffect, forwardRef } from 'react'
import { Search } from 'lucide-react'
import { useDebounce } from '@/hooks/useSearch'

interface SearchInputProps {
  placeholder?: string
  onSearch: (value: string) => void
  autoFocus?: boolean
  value?: string
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ placeholder = 'Search...', onSearch, autoFocus, value: controlledValue }, ref) => {
    const [value, setValue] = useState(controlledValue ?? '')
    const debounced = useDebounce(value, 150)

    useEffect(() => {
      onSearch(debounced)
    }, [debounced]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (controlledValue !== undefined) setValue(controlledValue)
    }, [controlledValue])

    return (
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-4 w-4 text-gray-300" />
        <input
          ref={ref}
          type="text"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-[34px] w-full rounded-md border border-gray-100 bg-white pl-8 pr-3 text-[13px] outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        />
      </div>
    )
  }
)
SearchInput.displayName = 'SearchInput'
