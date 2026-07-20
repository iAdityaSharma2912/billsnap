import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settingsStore'

/**
 * Loads the company list once (cached in settingsStore) and exposes a
 * resolver from company_key -> company_name, for use in dropdowns, labels,
 * and filters anywhere in the app.
 */
export function useCompanies() {
  const { settings, loaded, fetchSettings } = useSettingsStore()

  useEffect(() => {
    if (!loaded) fetchSettings()
  }, [loaded])

  function nameOf(companyKey: string): string {
    return settings.find((s) => s.company_key === companyKey)?.company_name ?? companyKey
  }

  return { companies: settings, loaded, nameOf }
}
