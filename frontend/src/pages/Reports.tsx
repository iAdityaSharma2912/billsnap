import { useEffect, useRef, useState } from 'react'
import { Printer } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { CompanyTabs } from '@/components/shared/CompanyTabs'
import { reportApi } from '@/services/reportApi'
import { useAppStore } from '@/store/appStore'
import { useCompanies } from '@/hooks/useCompanies'
import { api } from '@/services/api'
import type { DailyReport, MonthlyReport } from '@/types'

function todayISO()    { return new Date().toISOString().slice(0, 10) }
function thisMonthStr(){ return new Date().toISOString().slice(0, 7)  }

// ── Types for inventory report (mirrors backend InventoryReport schema) ──
interface InventoryReportRow {
  item_name: string
  unit: string
  total_qty: number
  total_amount: number
  invoice_count: number
}
interface InventoryReport {
  company: string
  period: string
  period_type: string
  rows: InventoryReportRow[]
  grand_qty: number
  grand_amount: number
}

type Tab = 'daily' | 'monthly' | 'inventory'

// ── Shared tab button ────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[6px] px-3.5 py-1.5 text-[12px] font-medium transition ${
        active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

export default function Reports() {
  const { pushToast, activeCompany, setActiveCompany } = useAppStore()
  const { nameOf } = useCompanies()

  const [tab, setTab]       = useState<Tab>('daily')
  const [date, setDate]     = useState(todayISO())
  const [month, setMonth]   = useState(thisMonthStr())
  const [daily, setDaily]   = useState<DailyReport | null>(null)
  const [monthly, setMonthly] = useState<MonthlyReport | null>(null)
  const [invReport, setInvReport] = useState<InventoryReport | null>(null)
  const [loading, setLoading] = useState(false)

  // ref for the printable inventory table section
  const printRef = useRef<HTMLDivElement>(null)

  // ── Fetch on tab/date/company change ──────────────────────────────────
  useEffect(() => {
    if (!activeCompany && tab === 'inventory') return
    setLoading(true)

    if (tab === 'daily') {
      reportApi.daily(date)
        .then(setDaily)
        .catch((e) => pushToast(e.message, 'error'))
        .finally(() => setLoading(false))
    } else if (tab === 'monthly') {
      reportApi.monthly(month)
        .then(setMonthly)
        .catch((e) => pushToast(e.message, 'error'))
        .finally(() => setLoading(false))
    } else {
      // inventory tab
      const params: Record<string, string> = {
        company: activeCompany,
        period_type: 'daily',
        date,
      }
      api.get<InventoryReport>('/report/inventory', { params })
        .then((r) => setInvReport(r.data))
        .catch((e) => pushToast(e.message, 'error'))
        .finally(() => setLoading(false))
    }
  }, [tab, date, month, activeCompany])

  // ── Print handler ─────────────────────────────────────────────────────
  function handlePrint() {
    if (!printRef.current) return
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Inventory Report — ${nameOf(activeCompany)} — ${date}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 20px; }
            h2 { font-size: 16px; margin-bottom: 2px; color: #042C53; }
            .meta { font-size: 11px; color: #888; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #E6F1FB; color: #042C53; text-align: left; padding: 6px 8px; font-size: 11px; }
            td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 12px; }
            td.num { text-align: right; }
            .total-row td { font-weight: bold; background: #E6F1FB; color: #042C53; }
            @media print { body { margin: 10mm; } }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 300)
  }

  // ── Stat card helper ──────────────────────────────────────────────────
  function StatCard({ label, value }: { label: string; value: string }) {
    return (
      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-card">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
        <div className="mono-amount mt-1 text-[24px] font-bold text-blue-900">{value}</div>
      </div>
    )
  }

  return (
    <>
      <Topbar title="Reports" showNewInvoice={false} />
      <div className="flex-1 overflow-y-auto px-5 py-4">

        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border border-gray-100 bg-white p-0.5">
            <TabBtn active={tab === 'daily'}     onClick={() => setTab('daily')}>Daily</TabBtn>
            <TabBtn active={tab === 'monthly'}   onClick={() => setTab('monthly')}>Monthly</TabBtn>
            <TabBtn active={tab === 'inventory'} onClick={() => setTab('inventory')}>Inventory</TabBtn>
          </div>

          {/* Date / month picker — shared across all tabs */}
          {tab !== 'inventory' && (
            tab === 'daily'
              ? <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="h-[34px] rounded-md border border-gray-100 px-3 text-[12px] focus:border-blue-400 focus:outline-none" />
              : <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                  className="h-[34px] rounded-md border border-gray-100 px-3 text-[12px] focus:border-blue-400 focus:outline-none" />
          )}

          {/* Inventory tab: company selector + date picker + print button */}
          {tab === 'inventory' && (
            <>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="h-[34px] rounded-md border border-gray-100 px-3 text-[12px] focus:border-blue-400 focus:outline-none" />
              <button
                onClick={handlePrint}
                disabled={!invReport || invReport.rows.length === 0}
                className="flex h-[34px] items-center gap-1.5 rounded-md border border-gray-100 bg-white px-3 text-[12px] text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                <Printer className="h-3.5 w-3.5" /> Print report
              </button>
            </>
          )}
        </div>

        {/* Company tabs — only on inventory tab */}
        {tab === 'inventory' && (
          <CompanyTabs value={activeCompany} onChange={setActiveCompany} />
        )}

        {loading && <div className="mt-4 text-[13px] text-gray-300">Loading...</div>}

        {/* ── Daily tab ───────────────────────────────────────────────── */}
        {tab === 'daily' && daily && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total sales" value={`₹${daily.total_amount.toLocaleString('en-IN')}`} />
              <StatCard label="Invoices"    value={String(daily.invoice_count)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-card">
                <div className="mb-2 text-[12px] font-semibold text-gray-900">Top customers</div>
                {daily.top_customers.length === 0
                  ? <div className="text-[12px] text-gray-300">No data</div>
                  : daily.top_customers.map((c, i) => (
                      <div key={i} className="flex justify-between py-1 text-[12px]">
                        <span>{c.name}</span>
                        <span className="mono-amount font-medium">₹{c.total.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
              </div>
              <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-card">
                <div className="mb-2 text-[12px] font-semibold text-gray-900">Payment breakdown</div>
                {Object.entries(daily.payment_breakdown).length === 0
                  ? <div className="text-[12px] text-gray-300">No data</div>
                  : Object.entries(daily.payment_breakdown).map(([mode, amt]) => (
                      <div key={mode} className="flex justify-between py-1 text-[12px]">
                        <span>{mode}</span>
                        <span className="mono-amount font-medium">₹{(amt as number).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Monthly tab ─────────────────────────────────────────────── */}
        {tab === 'monthly' && monthly && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total sales" value={`₹${monthly.total_amount.toLocaleString('en-IN')}`} />
              <StatCard label="Invoices"    value={String(monthly.invoice_count)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-card">
                <div className="mb-2 text-[12px] font-semibold text-gray-900">Weekly breakdown</div>
                {monthly.weekly_breakdown.length === 0
                  ? <div className="text-[12px] text-gray-300">No data</div>
                  : monthly.weekly_breakdown.map((w, i) => (
                      <div key={i} className="flex justify-between py-1 text-[12px]">
                        <span>{w.week}</span>
                        <span className="mono-amount font-medium">₹{w.total.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
              </div>
              <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-card">
                <div className="mb-2 text-[12px] font-semibold text-gray-900">Top items</div>
                {monthly.top_items.length === 0
                  ? <div className="text-[12px] text-gray-300">No data</div>
                  : monthly.top_items.map((it, i) => (
                      <div key={i} className="flex justify-between py-1 text-[12px]">
                        <span>{it.name}</span>
                        <span className="mono-amount font-medium">₹{it.total.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Inventory tab ───────────────────────────────────────────── */}
        {tab === 'inventory' && !loading && (
          <>
            {/* hidden printable div — rendered into a print popup by handlePrint() */}
            <div style={{ display: 'none' }}>
              <div ref={printRef}>
                {invReport && (
                  <>
                    <h2>Inventory Report — {nameOf(invReport.company)}</h2>
                    <div className="meta">Date: {invReport.period} &nbsp;|&nbsp; {invReport.rows.length} items</div>
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Item</th>
                          <th>Unit</th>
                          <th style={{ textAlign: 'right' }}>Qty billed</th>
                          <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                          <th style={{ textAlign: 'right' }}>Invoices</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invReport.rows.map((row, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{row.item_name}</td>
                            <td>{row.unit}</td>
                            <td className="num">{row.total_qty}</td>
                            <td className="num">{row.total_amount.toLocaleString('en-IN')}</td>
                            <td className="num">{row.invoice_count}</td>
                          </tr>
                        ))}
                        <tr className="total-row">
                          <td colSpan={3}>Total</td>
                          <td className="num">{invReport.grand_qty}</td>
                          <td className="num">{invReport.grand_amount.toLocaleString('en-IN')}</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>

            {/* on-screen inventory table */}
            {(!invReport || invReport.rows.length === 0) ? (
              <div className="mt-4 rounded-lg border border-gray-100 bg-white p-8 text-center text-[13px] text-gray-300 shadow-card">
                No invoices found for {nameOf(activeCompany)} on {date}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-gray-100 bg-white shadow-card">
                {/* summary row */}
                <div className="flex gap-6 border-b border-gray-50 px-4 py-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Items</div>
                    <div className="text-[18px] font-bold text-blue-900">{invReport.rows.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Total qty</div>
                    <div className="text-[18px] font-bold text-blue-900">{invReport.grand_qty}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Total amount</div>
                    <div className="mono-amount text-[18px] font-bold text-blue-900">
                      ₹{invReport.grand_amount.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* items table */}
                <table className="w-full">
                  <thead>
                    <tr className="bg-blue-50 text-left text-[11px] font-semibold uppercase tracking-wide text-blue-900">
                      <th className="px-4 py-2.5">#</th>
                      <th className="px-4 py-2.5">Item</th>
                      <th className="px-4 py-2.5">Unit</th>
                      <th className="px-4 py-2.5 text-right">Qty billed</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5 text-right">Invoices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invReport.rows.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-t border-gray-50 text-[12px] ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                      >
                        <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{row.item_name}</td>
                        <td className="px-4 py-2 text-gray-500">{row.unit}</td>
                        <td className="mono-amount px-4 py-2 text-right font-medium text-gray-900">{row.total_qty}</td>
                        <td className="mono-amount px-4 py-2 text-right font-medium text-gray-900">
                          ₹{row.total_amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">{row.invoice_count}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-blue-100 bg-blue-50 text-[12px] font-semibold text-blue-900">
                      <td colSpan={3} className="px-4 py-2.5">Total</td>
                      <td className="mono-amount px-4 py-2.5 text-right">{invReport.grand_qty}</td>
                      <td className="mono-amount px-4 py-2.5 text-right">₹{invReport.grand_amount.toLocaleString('en-IN')}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}

      </div>
    </>
  )
}
