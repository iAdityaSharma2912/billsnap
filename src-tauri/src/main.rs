// BillSnap desktop shell entry point.
//
// This file's job is narrow and deliberate: open the native window that
// shows the React UI, and manage the lifecycle of the Python backend
// sidecar process (billsnap-backend.exe) alongside it. All real business
// logic — invoices, inventory, PDFs, backups — lives in the Python
// backend, unchanged from the web version. Nothing here should grow
// business logic; if you find yourself wanting to add billing rules or
// data validation in Rust, that almost certainly belongs in the Python
// backend instead, in app/services/.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod sidecar;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::get_app_data_dir,
            commands::open_folder
        ])
        .setup(|app| {
            sidecar::spawn_backend(app.handle());
            Ok(())
        })
        .on_window_event(|event| {
    match event.event() {
        tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
            sidecar::kill_backend();
        }
        _ => {}
    }
})
        .run(tauri::generate_context!())
        .expect("error while running BillSnap");
}
