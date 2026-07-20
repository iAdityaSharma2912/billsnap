import { api } from './api'
import type { Customer, CustomerDetail } from '@/types'

export const customerApi = {
  list: (search?: string) =>
    api.get<Customer[]>('/customer/list', { params: { search } }).then((r) => r.data),

  get: (id: number) =>
    api.get<CustomerDetail>(`/customer/${id}`).then((r) => r.data),

  create: (data: { name: string; phone: string; address?: string; email?: string; notes?: string }) =>
    api.post<Customer>('/customer/create', data).then((r) => r.data),

  update: (id: number, data: Partial<Customer>) =>
    api.put<Customer>(`/customer/${id}`, data).then((r) => r.data),

  remove: (id: number) =>
    api.delete<{ success: boolean; message?: string }>(`/customer/${id}`).then((r) => r.data),
}
