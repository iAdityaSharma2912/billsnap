// Spawns and manages the billsnap-backend.exe sidecar — the packaged
// Python/FastAPI backend (see backend/billsnap-backend.spec for how
// that's built). This module is intentionally the ONLY place that knows
// how to start/stop that process; main.rs just calls into it.
//
// IMPORTANT, hard-won via direct testing: Tauri's CommandChild.kill()
// on Windows does NOT reliably terminate this sidecar. PyInstaller's
// --onefile bootloader execs the real Python/uvicorn process under a
// PID different from the one Tauri tracks (confirmed: uvicorn's own
// "Started server process [X]" log showed a different PID than the one
// taskkill /PID successfully terminated — the bootloader died, uvicorn
// kept running and kept listening on port 8000). Killing by PID is
// therefore unreliable for this specific binary. We kill by image name
// (/IM billsnap-backend.exe /T) instead, which kills every process with
// that name plus its full process tree, regardless of which PID
// PyInstaller's bootloader happens to report.
use std::sync::Mutex;
use tauri::api::process::{Command, CommandEvent};
use tauri::AppHandle;

static BACKEND_PROCESS: Mutex<Option<tauri::api::process::CommandChild>> = Mutex::new(None);

pub fn spawn_backend(_app: AppHandle) {
    // Guard against spawn_backend() being called more than once per app
    // launch. Belt-and-suspenders: the real double-process issue this
    // session turned out to be the kill bug above (an orphan from a
    // PREVIOUS launch colliding with a new one), not setup() firing
    // twice — but this guard costs nothing and protects against that
    // scenario too if it's ever introduced by a future Tauri change.
    {
        let guard = BACKEND_PROCESS.lock().unwrap();
        if guard.is_some() {
            eprintln!("[sidecar] spawn_backend() called while a backend is already tracked — ignoring duplicate call");
            return;
        }
    }

    // Belt-and-suspenders #2: forcibly clear any stray instance from a
    // PREVIOUS run of this app that might still be alive (e.g. if the
    // app crashed last time instead of closing cleanly, or an older
    // version's kill bug left one running). Spawning a fresh backend
    // while an old one still holds port 8000 is exactly the failure
    // mode that caused every "BillSnap couldn't start" error during
    // testing — so we clean the slate before spawning, not just after
    // closing.
    kill_all_billsnap_backend_processes();

    let mut env_vars = std::collections::HashMap::new();
    env_vars.insert("BILLSNAP_ENV".to_string(), "production".to_string());

    let (mut rx, child) = Command::new_sidecar("billsnap-backend")
        .expect("billsnap-backend sidecar not found — check tauri.conf.json externalBin and that backend/dist/billsnap-backend/ exists")
        .envs(env_vars)
        .spawn()
        .expect("failed to spawn billsnap-backend sidecar");

    eprintln!("[sidecar] spawned billsnap-backend, Tauri-tracked PID: {}", child.pid());
    *BACKEND_PROCESS.lock().unwrap() = Some(child);

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => println!("[backend] {}", line),
                CommandEvent::Stderr(line) => eprintln!("[backend:err] {}", line),
                CommandEvent::Error(err) => eprintln!("[backend:spawn-error] {}", err),
                CommandEvent::Terminated(payload) => {
                    eprintln!("[backend] exited with {:?}", payload.code);
                }
                _ => {}
            }
        }
    });
}

pub fn kill_backend() {
    // Clear our tracked handle regardless — we're killing by image name
    // below, which covers the real process whether or not Tauri's
    // tracked PID matches it.
    *BACKEND_PROCESS.lock().unwrap() = None;
    kill_all_billsnap_backend_processes();
}

/// Forcibly terminates every billsnap-backend.exe process and its full
/// process tree. See the module-level comment for why this is necessary
/// instead of CommandChild.kill() / taskkill by PID on Windows.
fn kill_all_billsnap_backend_processes() {
    #[cfg(target_os = "windows")]
    {
        let result = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "billsnap-backend.exe", "/T"])
            .output();
        match result {
            Ok(output) if output.status.success() => {
                eprintln!(
                    "[sidecar] taskkill /IM succeeded: {}",
                    String::from_utf8_lossy(&output.stdout).trim()
                );
            }
            Ok(output) => {
                // Exit code 128 means "no matching process found" — not
                // an error, just means there was nothing to kill. Any
                // other non-zero code gets logged for visibility.
                let stderr = String::from_utf8_lossy(&output.stderr);
                if !stderr.contains("not found") {
                    eprintln!("[sidecar] taskkill /IM non-success: {}", stderr.trim());
                }
            }
            Err(e) => eprintln!("[sidecar] taskkill failed to run at all: {:?}", e),
        }
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("pkill")
            .args(["-9", "-f", "billsnap-backend"])
            .output();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("pkill")
            .args(["-9", "-f", "billsnap-backend"])
            .output();
    }
}

/// Opens the given folder in the OS's native file explorer (File
/// Explorer on Windows, Finder on macOS, the default file manager on
/// Linux). Exposed to the frontend as a Tauri command (see
/// `commands::open_folder` in commands.rs) rather than using Tauri's
/// built-in `shell.open` JS API — that API has a documented bug on
/// Windows where paths containing spaces fail to open correctly
/// (https://github.com/tauri-apps/tauri/issues/6431), and BillSnap's
/// %APPDATA% path is very likely to contain a space (most Windows user
/// folders do, e.g. "C:\Users\Sharma Agency\AppData\..."). Spawning
/// `explorer.exe` directly with the path as a single argument sidesteps
/// that bug entirely.
pub fn open_folder_native(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    Ok(())
}