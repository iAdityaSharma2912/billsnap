import { create } from 'zustand'

const STORAGE_KEY = 'billsnap:notifications-enabled'

function readInitial(): boolean {
  try {
    // Default to enabled — a fresh install with no stored preference yet
    // should behave as "on" (matches what most users expect from a new
    // app), not silently opt them out.
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === null ? true : stored === 'true'
  } catch {
    // localStorage can throw in rare sandboxed contexts — fail safe to
    // "enabled" rather than crash the whole settings page over a
    // preference toggle.
    return true
  }
}

interface PreferencesState {
  notificationsEnabled: boolean
  setNotificationsEnabled: (enabled: boolean) => void
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  notificationsEnabled: readInitial(),
  setNotificationsEnabled: (enabled) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled))
    } catch {
      // Same reasoning as readInitial — don't let a storage failure
      // break the toggle itself, just the persistence of it.
    }
    set({ notificationsEnabled: enabled })
  },
}))
