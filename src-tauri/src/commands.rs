// Tauri commands invokable from the React frontend via
// `@tauri-apps/api/tauri`'s `invoke()`. Each one here is a thin,
// narrowly-scoped bridge to something the webview sandbox can't do on
// its own (reading OS-specific paths, launching File Explorer) — kept
// deliberately small; anything resembling business logic belongs in the
// Python backend, not here.
use tauri::AppHandle;

use crate::sidecar;

/// Returns the absolute path BillSnap's data lives in, matching exactly
/// what backend/app/core/paths.py computes for APP_DATA_DIR — same
/// %APPDATA%\BillSnap\ (production) or %APPDATA%\BillSnap-Dev\ (dev)
/// logic, just expressed in Rust since the frontend has no other way to
/// learn this path. The "BillSnap" vs "BillSnap-Dev" choice mirrors the
/// same BILLSNAP_ENV check used when spawning the sidecar (see
/// sidecar.rs) — keeping both paths derived from the same single
/// decision avoids the two ever disagreeing about where data lives.
#[tauri::command]
pub fn get_app_data_dir(app_handle: AppHandle) -> Result<String, String> {
    let is_production = std::env::var("BILLSNAP_ENV").unwrap_or_default() == "production";
    let folder_name = if is_production { "BillSnap" } else { "BillSnap-Dev" };

    // Tauri's own app_data_dir() already resolves the correct
    // per-OS/per-user base (Roaming\ on Windows) using the bundle
    // identifier from tauri.conf.json — reusing it instead of
    // hand-rolling another %APPDATA% lookup keeps this in one place.
    let base = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| "Could not resolve app data directory".to_string())?;

    // Tauri's app_data_dir() already appends the bundle identifier
    // (com.billsnap.app) as a folder — go up one level and use our own
    // BillSnap/BillSnap-Dev folder name instead, so this matches
    // EXACTLY what the Python backend computes, rather than introducing
    // a second, slightly-different folder Tauri made up on its own.
    let parent = base
        .parent()
        .ok_or_else(|| "Could not resolve parent of app data directory".to_string())?;

    Ok(parent.join(folder_name).to_string_lossy().to_string())
}

/// Opens the given folder path in the OS's native file explorer.
/// See sidecar::open_folder_native for why this doesn't use Tauri's
/// built-in shell.open API.
#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    sidecar::open_folder_native(&path)
}
