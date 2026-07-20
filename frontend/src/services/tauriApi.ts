/**
 * Thin wrapper around Tauri's desktop-only APIs (custom Rust commands,
 * notifications). Kept in one file so the rest of the app never imports
 * @tauri-apps/api directly — that keeps the "is this running inside
 * Tauri or a plain browser" check in exactly one place.
 *
 * WHY THE FALLBACK MATTERS: during development you might still open
 * http://localhost:1420 directly in a regular browser tab (e.g. to use
 * browser devtools more comfortably) instead of through `cargo tauri
 * dev`'s native window. window.__TAURI__ simply doesn't exist in that
 * case. Without guarding for that, every page that calls isTauri() === false
 * paths would throw on import and crash the whole app in plain-browser
 * dev mode — these wrappers instead resolve to a harmless no-op/null so
 * the rest of the UI keeps working, just without the desktop-only bits.
 */

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * Returns the absolute path BillSnap's data folder lives in
 * (%APPDATA%\BillSnap\ or %APPDATA%\BillSnap-Dev\ on Windows), or null
 * if not running inside Tauri. Mirrors backend/app/core/paths.py's
 * APP_DATA_DIR exactly — see src-tauri/src/commands.rs for how.
 */
export async function getAppDataDir(): Promise<string | null> {
  if (!isTauri()) return null
  const { invoke } = await import('@tauri-apps/api/tauri')
  return invoke<string>('get_app_data_dir')
}

/**
 * Opens the given folder in the OS's native file explorer. No-ops
 * outside Tauri (nothing sensible to do in a plain browser tab).
 */
export async function openFolder(path: string): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/tauri')
  await invoke('open_folder', { path })
}

/**
 * Requests OS notification permission if not already granted, then
 * shows a native desktop notification. Returns whether it was actually
 * shown — callers can use this to decide whether to fall back to an
 * in-app toast instead (see appStore's pushToast).
 */
export async function sendDesktopNotification(title: string, body: string): Promise<boolean> {
  if (!isTauri()) return false

  const { isPermissionGranted, requestPermission, sendNotification } = await import(
    '@tauri-apps/api/notification'
  )

  let granted = await isPermissionGranted()
  if (!granted) {
    const permission = await requestPermission()
    granted = permission === 'granted'
  }

  if (granted) {
    sendNotification({ title, body })
  }
  return granted
}

export { isTauri }
