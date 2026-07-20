import { NavLink } from 'react-router-dom'
import {
  LayoutGrid, Plus, List, Users, Package, RefreshCw,
  TrendingUp, Download, Shield, Settings as SettingsIcon,
} from 'lucide-react'
import { Logo } from '@/components/shared/Logo'

const navSections = [
  {
    label: 'Main',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutGrid },
      { to: '/invoice/new', label: 'New invoice', icon: Plus, shortcut: '⌃N' },
      { to: '/invoices', label: 'Invoice history', icon: List },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/inventory', label: 'Inventory', icon: Package },
      { to: '/import', label: 'Import from Tally', icon: RefreshCw },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports', label: 'Reports', icon: TrendingUp },
      { to: '/export', label: 'Export', icon: Download, shortcut: '⌃E' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/backup', label: 'Backup', icon: Shield, shortcut: '⌃B' },
      { to: '/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
]

export function Sidebar() {
  return (
    <aside className="flex h-screen w-sidebar flex-shrink-0 flex-col bg-blue-900 text-white">
      <div className="px-5 py-5">
        <Logo variant="full" size={34} />
        <div className="mt-1.5 text-[11px] text-white/40">● Offline · v1.0</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
        {navSections.map((section) => (
          <div key={section.label} className="mb-1">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/30">
              {section.label}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition ${
                    isActive ? 'bg-blue-600/25 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-[15px] w-[15px] flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.shortcut && <span className="text-[10px] text-white/30">{item.shortcut}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
