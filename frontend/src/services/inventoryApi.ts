import { api } from './api'
import type { InventoryItem } from '@/types'

export const inventoryApi = {
  list: (companyKey: string, params?: { search?: string; category?: string }) =>
    api.get<InventoryItem[]>('/inventory/list', { params: { company_key: companyKey, ...params } }).then((r) => r.data),

  search: (companyKey: string, q: string) =>
    api.get<InventoryItem[]>('/inventory/search', { params: { company_key: companyKey, q } }).then((r) => r.data),

  lowStock: (companyKey: string) =>
    api.get<InventoryItem[]>('/inventory/low-stock', { params: { company_key: companyKey } }).then((r) => r.data),

  create: (data: Omit<InventoryItem, 'id' | 'low_stock'>) =>
    api.post<InventoryItem>('/inventory/create', data).then((r) => r.data),

  update: (id: number, data: Partial<InventoryItem>) =>
    api.put<InventoryItem>(`/inventory/${id}`, data).then((r) => r.data),
}
