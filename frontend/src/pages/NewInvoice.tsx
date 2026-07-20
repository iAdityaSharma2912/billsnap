import { useParams } from 'react-router-dom'
import { Topbar } from '@/components/layout/Topbar'
import { InvoiceForm } from '@/components/invoice/InvoiceForm'

export default function NewInvoice() {
  const params = useParams<{ id?: string }>()
  return (
    <>
      <Topbar title={params.id ? 'Edit invoice' : 'New invoice'} showNewInvoice={false} />
      <InvoiceForm />
    </>
  )
}
