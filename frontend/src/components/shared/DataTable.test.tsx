import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable } from './DataTable'

interface Row {
  id: number
  name: string
  amount: number
}

const rows: Row[] = [
  { id: 1, name: 'Rajesh Kumar', amount: 2300 },
  { id: 2, name: 'Amit Singh', amount: 1500 },
]

describe('DataTable', () => {
  it('renders rows and columns', () => {
    render(
      <DataTable<Row>
        data={rows}
        keyAccessor={(r) => r.id}
        columns={[
          { header: 'Name', accessor: (r) => r.name },
          { header: 'Amount', accessor: (r) => r.amount, align: 'right' },
        ]}
      />
    )
    expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument()
    expect(screen.getByText('Amit Singh')).toBeInTheDocument()
  })

  it('shows empty message when no data', () => {
    render(
      <DataTable<Row>
        data={[]}
        keyAccessor={(r) => r.id}
        emptyMessage="Nothing here"
        columns={[{ header: 'Name', accessor: (r) => r.name }]}
      />
    )
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('calls onRowClick when a row is clicked', () => {
    const onRowClick = vi.fn()
    render(
      <DataTable<Row>
        data={rows}
        keyAccessor={(r) => r.id}
        onRowClick={onRowClick}
        columns={[{ header: 'Name', accessor: (r) => r.name }]}
      />
    )
    fireEvent.click(screen.getByText('Rajesh Kumar'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })
})
