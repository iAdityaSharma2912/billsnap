interface LogoProps {
  size?: number
  /** 'mark' = icon only, 'full' = icon + wordmark side by side */
  variant?: 'mark' | 'full'
  className?: string
}

/**
 * BillSnap's mark: a receipt shape (the billing part) with a lightning
 * bolt cut through it (the "snap" — fast, instant). The zig-zag bottom
 * edge reads as a torn receipt stub, which doubles as a nod to the
 * Original/Duplicate tear-off invoices the app generates.
 */
export function Logo({ size = 32, variant = 'mark', className = '' }: LogoProps) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="billsnap-grad" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#378ADD" />
          <stop offset="1" stopColor="#185FA5" />
        </linearGradient>
      </defs>

      {/* Rounded badge background */}
      <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#billsnap-grad)" />

      {/* Receipt body with a torn/zig-zag bottom edge */}
      <path
        d="M12 9.5C12 8.67 12.67 8 13.5 8h13c.83 0 1.5.67 1.5 1.5v19.7l-2.2-1.5-2.2 1.5-2.2-1.5-2.2 1.5-2.2-1.5-2.2 1.5-2.2-1.5-2.2 1.5V9.5Z"
        fill="white"
        fillOpacity="0.95"
      />
      {/* Receipt text lines */}
      <rect x="15" y="12.5" width="10" height="1.6" rx="0.8" fill="#185FA5" fillOpacity="0.35" />
      <rect x="15" y="16" width="7" height="1.6" rx="0.8" fill="#185FA5" fillOpacity="0.35" />

      {/* Lightning bolt — the "Snap" */}
      <path
        d="M22.5 13.5 16 22.5h4.2l-1.3 6.5 7.6-9.8h-4.4l1.4-5.7Z"
        fill="#FAC775"
        stroke="#854F0B"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  )

  if (variant === 'mark') return mark

  return (
    <div className="flex items-center gap-2">
      {mark}
      <span className="text-[17px] font-semibold tracking-tight text-white">
        Bill<span className="text-amber-100">Snap</span>
      </span>
    </div>
  )
}
