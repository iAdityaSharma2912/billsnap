import { useEffect, useRef, useState } from 'react'
import { Logo } from '@/components/shared/Logo'

type ReadyState = 'checking' | 'ready' | 'failed'

const POLL_INTERVAL_MS = 400
// Generous ceiling: on a slow shop PC, antivirus may scan the freshly
// extracted billsnap-backend.exe on its very first run, which can add
// several seconds beyond the ~2s we measured on a clean machine. 45s
// covers that without leaving someone staring at a frozen screen forever
// if the backend genuinely failed to start.
const MAX_WAIT_MS = 45_000
// Each individual health-check request gets its own short timeout,
// separate from the shared axios instance's 15s default. Using the
// 15s default here was the actual bug that caused real failures: a
// single slow-but-eventually-successful request could burn 15 of the
// 30-second budget in one attempt, leaving only one or two retries
// total instead of the dozens this polling loop is designed around.
const PER_ATTEMPT_TIMEOUT_MS = 1500

async function checkHealth(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS)
    const res = await fetch('http://localhost:8000/health', { signal: controller.signal })
    clearTimeout(timeoutId)
    return res.ok
  } catch {
    return false
  }
}

/**
 * Wraps the entire app. Tauri starts the window and the Python backend
 * sidecar at roughly the same time — the backend takes a couple of
 * seconds (longer on a slow PC, or on the very first launch when
 * antivirus may scan the freshly-extracted --onefile exe) to import
 * FastAPI/SQLAlchemy/pandas and start listening.
 *
 * Uses a plain fetch() with its own short per-attempt timeout rather
 * than the shared axios `api` instance — that instance's 15s default
 * timeout meant a single slow attempt could exhaust almost the entire
 * polling budget, leaving too few retries. A short per-attempt timeout
 * plus many retries is the right shape for "wait for a thing to become
 * available", as opposed to "make one request and wait reasonably for
 * its real response" (what the rest of the app correctly uses `api` for).
 */
export function BackendReadyGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ReadyState>('checking')
  const startedAtRef = useRef(Date.now())
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    startedAtRef.current = Date.now()

    async function poll() {
      while (!cancelled) {
        const healthy = await checkHealth()
        if (healthy) {
          if (!cancelled) setState('ready')
          return
        }
        if (Date.now() - startedAtRef.current > MAX_WAIT_MS) {
          if (!cancelled) setState('failed')
          return
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      }
    }

    poll()
    return () => { cancelled = true }
    // Re-runs whenever `attempt` changes — i.e. when the user clicks Retry.
  }, [attempt])

  if (state === 'ready') return <>{children}</>

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-page">
      <Logo size={48} />
      {state === 'checking' && (
        <>
          <div className="h-1 w-40 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-600" />
          </div>
          <p className="text-[12px] text-gray-400">Starting BillSnap...</p>
        </>
      )}
      {state === 'failed' && (
        <div className="text-center">
          <p className="text-[13px] font-medium text-red-600">BillSnap couldn't start</p>
          <p className="mt-1 max-w-xs text-[12px] text-gray-500">
            The background service didn't respond in time. This can happen on a slow first
            launch — click below to check again.
          </p>
          <button
            onClick={() => {
              setState('checking')
              setAttempt((a) => a + 1)
            }}
            className="mt-3 rounded-md bg-blue-600 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-blue-800"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}