import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

const iconMap = {
  success: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  error: <XCircle className="h-4 w-4 text-red-600" />,
  info: <Info className="h-4 w-4 text-blue-600" />,
}

const bgMap = {
  success: 'bg-green-50 border-green-600/20',
  error: 'bg-red-50 border-red-600/20',
  info: 'bg-blue-50 border-blue-600/20',
}

export function ToastContainer() {
  const { toasts, dismissToast } = useAppStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-[13px] shadow-card ${bgMap[t.type]}`}
        >
          {iconMap[t.type]}
          <span className="text-gray-900">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="ml-2 text-gray-300 hover:text-gray-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
