import { ReactNode } from 'react'

export interface Column<T> {
  header: string
  accessor: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyAccessor: (row: T) => string | number
  onRowClick?: (row: T) => void
  emptyMessage?: string
  rowClassName?: (row: T) => string
}

export function DataTable<T>({
  columns,
  data,
  keyAccessor,
  onRowClick,
  emptyMessage = 'No records found',
  rowClassName,
}: DataTableProps<T>) {
  const alignClass = (a?: string) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white shadow-card">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {columns.map((col, i) => (
              <th
                key={i}
                style={{ width: col.width }}
                className={`px-3 py-2.5 font-semibold uppercase tracking-wide text-[11px] text-gray-500 ${alignClass(col.align)}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyAccessor(row)}
                onClick={() => onRowClick?.(row)}
                className={`h-10 border-b border-gray-50 last:border-0 ${
                  onRowClick ? 'cursor-pointer hover:bg-blue-50/50' : ''
                } ${rowClassName?.(row) ?? ''}`}
              >
                {columns.map((col, i) => (
                  <td key={i} className={`px-3 text-gray-900 ${alignClass(col.align)}`}>
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
