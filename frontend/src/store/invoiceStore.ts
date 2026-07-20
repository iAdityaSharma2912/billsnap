import { create } from 'zustand'
import type { Company, InvoiceItemInput, InvoiceDetail } from '@/types'

interface InvoiceDraft {
  company: Company
  customerId: number | null
  customerName: string
  customerPhone: string
  customerAddress: string
  paymentMode: string
  remarks: string
  items: InvoiceItemInput[]
  /** Set when editing an existing invoice instead of creating a new one.
   * null means "creating a new invoice". */
  editingInvoiceId: number | null
  editingInvoiceNumber: string
}

interface InvoiceState extends InvoiceDraft {
  setCompany: (c: Company) => void
  setCustomer: (id: number, name: string, phone: string, address: string) => void
  clearCustomer: () => void
  setPaymentMode: (m: string) => void
  setRemarks: (r: string) => void
  addItem: (item: InvoiceItemInput) => void
  updateItem: (index: number, item: Partial<InvoiceItemInput>) => void
  removeItem: (index: number) => void
  reset: () => void
  grandTotal: () => number
  /** Populates the draft from an existing invoice so it can be edited.
   * Company and date are intentionally not changed by editing — only the
   * customer, payment mode, remarks, and items are. */
  loadFromInvoice: (invoice: InvoiceDetail) => void
}

const initialDraft: InvoiceDraft = {
  company: 'SA',
  customerId: null,
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  paymentMode: 'Cash',
  remarks: '',
  items: [],
  editingInvoiceId: null,
  editingInvoiceNumber: '',
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  ...initialDraft,

  setCompany: (c) => set({ company: c }),

  setCustomer: (id, name, phone, address) =>
    set({ customerId: id, customerName: name, customerPhone: phone, customerAddress: address }),

  clearCustomer: () =>
    set({ customerId: null, customerName: '', customerPhone: '', customerAddress: '' }),

  setPaymentMode: (m) => set({ paymentMode: m }),
  setRemarks: (r) => set({ remarks: r }),

  addItem: (item) => set((state) => ({ items: [...state.items, item] })),

  updateItem: (index, patch) =>
    set((state) => ({
      items: state.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    })),

  removeItem: (index) =>
    set((state) => ({ items: state.items.filter((_, i) => i !== index) })),

  reset: () => set({ ...initialDraft }),

  grandTotal: () => get().items.reduce((sum, it) => sum + it.qty * it.rate, 0),

  loadFromInvoice: (invoice) =>
    set({
      company: invoice.company,
      customerId: invoice.customer_id,
      customerName: invoice.customer_name,
      customerPhone: invoice.customer_phone,
      customerAddress: invoice.customer_address,
      paymentMode: invoice.payment_mode,
      remarks: invoice.remarks || '',
      items: invoice.items.map((it) => ({
        inventory_id: it.inventory_id,
        item_name: it.item_name,
        unit: it.unit,
        qty: it.qty,
        rate: it.rate,
      })),
      editingInvoiceId: invoice.id,
      editingInvoiceNumber: invoice.invoice_number,
    }),
}))
