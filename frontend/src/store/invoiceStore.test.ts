import { describe, it, expect, beforeEach } from 'vitest'
import { useInvoiceStore } from './invoiceStore'

describe('useInvoiceStore', () => {
  beforeEach(() => {
    useInvoiceStore.getState().reset()
  })

  it('starts with empty items and zero total', () => {
    const state = useInvoiceStore.getState()
    expect(state.items).toEqual([])
    expect(state.grandTotal()).toBe(0)
  })

  it('adds an item and computes grand total', () => {
    useInvoiceStore.getState().addItem({ item_name: 'RR Cable', unit: 'Mtr', qty: 50, rate: 28 })
    const state = useInvoiceStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.grandTotal()).toBe(1400)
  })

  it('sums multiple items correctly', () => {
    useInvoiceStore.getState().addItem({ item_name: 'RR Cable', unit: 'Mtr', qty: 50, rate: 28 })
    useInvoiceStore.getState().addItem({ item_name: 'Switch', unit: 'Pcs', qty: 20, rate: 45 })
    expect(useInvoiceStore.getState().grandTotal()).toBe(2300)
  })

  it('removes an item by index', () => {
    useInvoiceStore.getState().addItem({ item_name: 'A', unit: 'Pcs', qty: 1, rate: 10 })
    useInvoiceStore.getState().addItem({ item_name: 'B', unit: 'Pcs', qty: 1, rate: 20 })
    useInvoiceStore.getState().removeItem(0)
    const state = useInvoiceStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].item_name).toBe('B')
  })

  it('sets and clears customer', () => {
    useInvoiceStore.getState().setCustomer(5, 'Rajesh Kumar', '9876543210', 'Karol Bagh')
    expect(useInvoiceStore.getState().customerId).toBe(5)
    useInvoiceStore.getState().clearCustomer()
    expect(useInvoiceStore.getState().customerId).toBeNull()
  })

  it('reset clears the whole draft', () => {
    useInvoiceStore.getState().addItem({ item_name: 'A', unit: 'Pcs', qty: 1, rate: 10 })
    useInvoiceStore.getState().setCustomer(1, 'X', '123', 'addr')
    useInvoiceStore.getState().reset()
    const state = useInvoiceStore.getState()
    expect(state.items).toEqual([])
    expect(state.customerId).toBeNull()
  })

  it('loadFromInvoice populates the draft and marks editing mode', () => {
    useInvoiceStore.getState().loadFromInvoice({
      id: 42,
      invoice_number: 'SA-20260624-001',
      company: 'SA',
      customer_id: 7,
      customer_name: 'Ramesh Traders',
      invoice_date: '2026-06-24',
      grand_total: 1400,
      payment_mode: 'UPI',
      remarks: 'Handle with care',
      pdf_path: 'invoices/2026/June/SA-20260624-001.pdf',
      created_at: '2026-06-24T10:00:00',
      customer_phone: '9876543210',
      customer_address: 'Karol Bagh',
      items: [
        { id: 1, inventory_id: 3, item_name: 'RR Cable', unit: 'Mtr', qty: 50, rate: 28, amount: 1400 },
      ],
    } as any)

    const state = useInvoiceStore.getState()
    expect(state.editingInvoiceId).toBe(42)
    expect(state.editingInvoiceNumber).toBe('SA-20260624-001')
    expect(state.company).toBe('SA')
    expect(state.customerId).toBe(7)
    expect(state.customerName).toBe('Ramesh Traders')
    expect(state.paymentMode).toBe('UPI')
    expect(state.remarks).toBe('Handle with care')
    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toEqual({
      inventory_id: 3, item_name: 'RR Cable', unit: 'Mtr', qty: 50, rate: 28,
    })
  })

  it('reset clears editing mode set by loadFromInvoice', () => {
    useInvoiceStore.getState().loadFromInvoice({
      id: 42, invoice_number: 'SA-1', company: 'SA', customer_id: 1,
      customer_name: 'X', invoice_date: '2026-01-01', grand_total: 0,
      payment_mode: 'Cash', remarks: null, pdf_path: null, created_at: '',
      customer_phone: '', customer_address: '', items: [],
    } as any)
    expect(useInvoiceStore.getState().editingInvoiceId).toBe(42)

    useInvoiceStore.getState().reset()
    expect(useInvoiceStore.getState().editingInvoiceId).toBeNull()
  })
})
