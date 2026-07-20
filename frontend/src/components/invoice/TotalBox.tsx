interface TotalBoxProps {
  total: number
}

export function TotalBox({ total }: TotalBoxProps) {
  return (
    <div className="mt-3 flex justify-end">
      <div className="min-w-[180px] rounded-md border border-blue-100 bg-blue-50 px-4 py-2.5">
        <div className="mb-1 text-[11px] text-blue-800">Grand total</div>
        <div className="mono-amount text-right text-[22px] font-bold text-blue-900">
          ₹ {total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  )
}
