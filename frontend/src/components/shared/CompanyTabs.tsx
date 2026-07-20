import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import type { Company } from '@/types'

interface CompanyTabsProps {
  value: Company
  onChange: (c: Company) => void
  disabled?: boolean
}

/**
 * Renders one tab per company configured in Settings → Companies.
 * Companies are dynamic — adding a new one there makes it show up here
 * automatically, no code change needed.
 */
export function CompanyTabs({ value, onChange, disabled = false }: CompanyTabsProps) {
  const { settings, loaded, fetchSettings } = useSettingsStore()

  useEffect(() => {
    if (!loaded) fetchSettings()
  }, [loaded])

  // If the currently-selected company no longer exists (e.g. it was just
  // deleted), fall back to the first available one. Skipped while
  // disabled (e.g. editing an existing invoice) since the company there
  // is fixed and shouldn't be silently swapped out from under the form.
  useEffect(() => {
    if (!disabled && loaded && settings.length > 0 && !settings.some((s) => s.company_key === value)) {
      onChange(settings[0].company_key)
    }
  }, [loaded, settings, disabled])

  if (!loaded || settings.length === 0) {
    return <div className="h-[34px] w-48 animate-pulse rounded-md bg-gray-50" />
  }

  return (
    <div className={`inline-flex rounded-md border border-gray-100 bg-white p-0.5 shadow-card ${disabled ? 'opacity-60' : ''}`}>
      {settings.map((s) => (
        <button
          key={s.company_key}
          onClick={() => !disabled && onChange(s.company_key)}
          disabled={disabled}
          className={`rounded-[6px] px-3.5 py-1.5 text-[12px] font-medium transition ${
            value === s.company_key ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
          } ${disabled ? 'cursor-not-allowed' : ''}`}
        >
          {s.company_name}
        </button>
      ))}
    </div>
  )
}
