import { Clock } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'

/**
 * Tally import is planned but not yet implemented.
 * The route /import is kept active so the sidebar link continues to work
 * and does not need to be removed or hidden.
 */
export default function TallyImport() {
  return (
    <>
      <Topbar title="Import from Tally" showNewInvoice={false} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <Clock className="h-8 w-8 text-blue-400" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-gray-900">Coming Soon</p>
          <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-gray-400">
            Tally import (stock items &amp; customers from Excel/CSV export) is under development
            and will be available in a future update.
          </p>
        </div>
      </div>
    </>
  )
}
