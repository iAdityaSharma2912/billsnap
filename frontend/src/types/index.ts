// TypeScript interfaces mirroring the backend Pydantic schemas.

// Companies are dynamic now — any short code created in Settings → Companies
// is valid. This is just a string, not a fixed union, so new companies work
// without a frontend code change.
export type Company = string
export type PaymentMode = 'Cash' | 'Credit' | 'UPI' | 'Bank transfer' | 'Cheque'

export interface Customer {
  id: number
  name: string
  phone: string
  address?: string
  email?: string | null
  notes?: string | null
  created_at: string
}

export interface CustomerDetail extends Customer {
  total_purchases: number
  invoice_count: number
}

export interface InventoryItem {
  id: number
  company_key: string
  item_name: string
  category: string
  unit: string
  selling_price: number
  current_stock: number
  min_stock: number
  remarks?: string | null
  low_stock: boolean
}

export interface InvoiceItemInput {
  inventory_id?: number | null
  item_name: string
  unit: string
  qty: number
  rate: number
}

export interface InvoiceItem extends InvoiceItemInput {
  id: number
  amount: number
}

export interface Invoice {
  id: number
  invoice_number: string
  company: Company
  customer_id: number
  customer_name: string
  invoice_date: string
  grand_total: number
  payment_mode: PaymentMode | string
  remarks?: string | null
  pdf_path?: string | null
  created_at: string
}

export interface InvoiceDetail extends Invoice {
  customer_name: string
  customer_phone: string
  customer_address: string
  items: InvoiceItem[]
}

export interface Settings {
  id: number
  company_key: Company
  company_name: string
  address: string
  phone: string
  bank_details?: string | null
  upi_id?: string | null
  show_payment_block: number
  created_at?: string | null
}

export interface DailyReport {
  date: string
  total_amount: number
  invoice_count: number
  top_customers: { name: string; total: number }[]
  payment_breakdown: Record<string, number>
}

export interface MonthlyReport {
  month: string
  total_amount: number
  invoice_count: number
  weekly_breakdown: { week: string; total: number }[]
  top_items: { name: string; total: number }[]
}

export interface AppLogEntry {
  id: number
  level: string
  message: string
  logged_at: string
}
