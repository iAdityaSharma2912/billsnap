import { create } from 'zustand'
import type { Settings } from '@/types'
import { settingsApi } from '@/services/reportApi'

interface SettingsState {
  settings: Settings[]
  loaded: boolean
  fetchSettings: () => Promise<void>
  getByCompany: (key: string) => Settings | undefined
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: [],
  loaded: false,

  fetchSettings: async () => {
    const data = await settingsApi.list()
    set({ settings: data, loaded: true })
  },

  getByCompany: (key) => get().settings.find((s) => s.company_key === key),
}))
