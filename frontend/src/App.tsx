import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { ToastContainer } from '@/components/shared/Toast'
import { BackendReadyGate } from '@/components/shared/BackendReadyGate'
import { CompanySetupGate } from '@/components/shared/CompanySetupGate'
import { useKeyboard } from '@/hooks/useKeyboard'

import Dashboard from '@/pages/Dashboard'
import NewInvoice from '@/pages/NewInvoice'
import InvoiceHistory from '@/pages/InvoiceHistory'
import Customers from '@/pages/Customers'
import Inventory from '@/pages/Inventory'
import TallyImport from '@/pages/TallyImport'
import Reports from '@/pages/Reports'
import ExportPage from '@/pages/Export'
import Backup from '@/pages/Backup'
import SettingsPage from '@/pages/Settings'

function GlobalShortcuts() {
  const navigate = useNavigate()
  useKeyboard({
    'ctrl+n': () => navigate('/invoice/new'),
    'ctrl+e': () => navigate('/export'),
    'ctrl+b': () => navigate('/backup'),
  })
  return null
}

function AppLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-page">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoice/new" element={<NewInvoice />} />
          <Route path="/invoice/:id/edit" element={<NewInvoice />} />
          <Route path="/invoices" element={<InvoiceHistory />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/import" element={<TallyImport />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/backup" element={<Backup />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <ToastContainer />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <BackendReadyGate>
        <CompanySetupGate>
          <GlobalShortcuts />
          <AppLayout />
        </CompanySetupGate>
      </BackendReadyGate>
    </BrowserRouter>
  )
}
