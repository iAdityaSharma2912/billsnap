import { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  accent?: 'blue' | 'teal' | 'amber' | 'coral' | 'red' | 'green'
  sub?: string
}

const accentMap = {
  blue: 'bg-blue-50 text-blue-800',
  teal: 'bg-teal-50 text-teal-600',
  amber: 'bg-amber-50 text-amber-600',
  coral: 'bg-coral-50 text-coral-600',
  red: 'bg-red-50 text-red-600',
  green: 'bg-green-50 text-green-600',
}

export function StatCard({ label, value, icon, accent = 'blue', sub }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
        {icon && <div className={`rounded-md p-1.5 ${accentMap[accent]}`}>{icon}</div>}
      </div>
      <div className="mono-amount mt-2 text-[22px] font-semibold text-gray-900">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-gray-500">{sub}</div>}
    </div>
  )
}
