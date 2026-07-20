import { useEffect } from 'react'

type ShortcutMap = Record<string, (e: KeyboardEvent) => void>

/**
 * Global keyboard shortcut listener.
 * Keys use the format "ctrl+s", "ctrl+n", "ctrl+p", "ctrl+b", "esc", "enter".
 */
export function useKeyboard(shortcuts: ShortcutMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    function handler(e: KeyboardEvent) {
      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push('ctrl')
      if (e.shiftKey) parts.push('shift')

      let key = e.key.toLowerCase()
      if (key === 'escape') key = 'esc'
      parts.push(key)

      const combo = parts.join('+')
      if (shortcuts[combo]) {
        e.preventDefault()
        shortcuts[combo](e)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts, enabled])
}
