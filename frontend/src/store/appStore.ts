import { create } from 'zustand'
import type { Company } from '@/types'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface AppState {
  activeCompany: Company
  setActiveCompany: (c: Company) => void

  toasts: Toast[]
  pushToast: (message: string, type?: Toast['type']) => void
  dismissToast: (id: number) => void
}

let toastId = 0

export const useAppStore = create<AppState>((set) => ({
  // No company is hardcoded here. A fresh install has zero companies
  // until CompanySetupGate's first-run wizard creates one — see
  // CompanySetup.tsx, which calls setActiveCompany() itself once that
  // happens. On normal (non-first-run) launches, useCompanies' effect
  // below sets this to the first company in the list as soon as
  // settings load, so the app never sits with an empty activeCompany
  // for long, but it CAN legitimately be '' for a brief moment on boot.
  activeCompany: '',
  setActiveCompany: (c) => set({ activeCompany: c }),

  toasts: [],
  pushToast: (message, type = 'info') => {
    const id = ++toastId
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 3500)
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
