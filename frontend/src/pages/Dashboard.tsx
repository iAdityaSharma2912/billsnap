import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IndianRupee, Receipt, AlertTriangle, Users } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { CompanyTabs } from '@/components/shared/CompanyTabs'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable } from '@/components/shared/DataTable'
import { useAppStore } from '@/store/appStore'
import { useCompanies } from '@/hooks/useCompanies'
import { usePreferencesStore } from '@/store/preferencesStore'
import { sendDesktopNotification } from '@/services/tauriApi'
import { reportApi } from '@/services/reportApi'
import { invoiceApi } from '@/services/invoiceApi'
import { inventoryApi } from '@/services/inventoryApi'
import { customerApi } from '@/services/customerApi'
import type { Invoice, DailyReport, InventoryItem } from '@/types'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { activeCompany, setActiveCompany, pushToast } = useAppStore()
  const { nameOf } = useCompanies()
  const { notificationsEnabled } = usePreferencesStore()

  const [report, setReport] = useState<DailyReport | null>(null)
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([])
  const [lowStock, setLowStock] = useState<InventoryItem[]>([])
  const [customerCount, setCustomerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Tracks which company+count combination we've already notified about,
  // so switching tabs back and forth between two companies that both
  // have e.g. 3 low-stock items doesn't re-fire a notification each time
  // — only a genuinely NEW low-stock state (different count, or first
  // time seeing this company in this session) does.
  const lastNotifiedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!activeCompany) return
    let active = true
    setLoading(true)
    Promise.all([
      reportApi.daily(todayISO()).catch(() => null),
      invoiceApi.list({ company: activeCompany }).catch(() => []),
      inventoryApi.lowStock(activeCompany).catch(() => []),
      customerApi.list().catch(() => []),
    ])
      .then(([rep, invoices, low, customers]) => {
        if (!active) return
        setReport(rep)
        setRecentInvoices(invoices.slice(0, 8))
        setLowStock(low)
        setCustomerCount(customers.length)

        if (notificationsEnabled && low.length > 0) {
          const key = `${activeCompany}:${low.length}`
          if (lastNotifiedRef.current !== key) {
            lastNotifiedRef.current = key
            sendDesktopNotification(
              'Low stock alert',
              `${low.length} item${low.length > 1 ? 's' : ''} running low on stock for ${nameOf(activeCompany)}`
            )
          }
        }
      })
      .catch(() => pushToast('Could not load dashboard data', 'error'))
      .finally(() => setLoading(false))
    return () => {
      active = false
    }
  }, [activeCompany])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const dateLabel = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <>
      <Topbar title={`${greeting} — ${dateLabel}`} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-3.5 flex items-center gap-3">
          <CompanyTabs value={activeCompany} onChange={setActiveCompany} />
          <span className="text-[11px] text-gray-300">
            Showing data for {nameOf(activeCompany)}
          </span>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-3">
          <StatCard
            label="Today's sales"
            value={`₹${(report?.total_amount ?? 0).toLocaleString('en-IN')}`}
            icon={<IndianRupee className="h-4 w-4" />}
            accent="blue"
          />
          <StatCard
            label="Invoices today"
            value={report?.invoice_count ?? 0}
            icon={<Receipt className="h-4 w-4" />}
            accent="teal"
          />
          <StatCard
            label="Low stock items"
            value={lowStock.length}
            icon={<AlertTriangle className="h-4 w-4" />}
            accent="red"
            sub={lowStock.length > 0 ? 'Needs attention' : 'All good'}
          />
          <StatCard
            label="Total customers"
            value={customerCount}
            icon={<Users className="h-4 w-4" />}
            accent="green"
          />
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-3.5 shadow-card">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gray-900">Recent invoices</span>
            <button onClick={() => navigate('/invoices')} className="text-[11px] text-blue-600 hover:underline">
              View all →
            </button>
          </div>
          <DataTable<Invoice>
            data={recentInvoices}
            keyAccessor={(r) => r.id}
            emptyMessage={loading ? 'Loading...' : 'No invoices yet — create your first invoice'}
            onRowClick={(r) => navigate(`/invoices?open=${r.id}`)}
            columns={[
              { header: 'Invoice #', accessor: (r) => <span className="font-medium text-blue-600">{r.invoice_number}</span> },
              { header: 'Date', accessor: (r) => r.invoice_date },
              { header: 'Amount', accessor: (r) => <span className="mono-amount">₹{r.grand_total.toLocaleString('en-IN')}</span>, align: 'right' },
              { header: 'Mode', accessor: (r) => r.payment_mode },
            ]}
          />
        </div>
      </div>
    </>
  )
}
