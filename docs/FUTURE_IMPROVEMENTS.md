# BillSnap — Future Improvements

Things that were deliberately out of scope for this migration, or
identified as gaps along the way, ordered roughly by how soon they'd be
worth addressing.

## Worth doing soon

- **Verify printing inside an actual Tauri window.** The existing
  iframe-based print flow was never re-tested inside WebView2 during
  this migration (only confirmed in a regular browser, since this
  environment can't run a Windows GUI). This is the single highest-
  priority thing to manually check once `cargo tauri dev` is running.
- **Code signing.** Right now, running the installer triggers a
  Windows SmartScreen warning ("Windows protected your PC") because the
  app is unsigned. A code-signing certificate (there are inexpensive
  options for individual developers) removes this warning and makes the
  app look more trustworthy to a shop owner installing it for the first
  time.
- **Fix the stale "delete last company" guard.** `settings_api.py`'s
  `delete_company` still blocks deleting the last remaining company
  (`count() <= 1` check) — left over from when every install always had
  2 companies. This doesn't block the first-run flow (which *creates*
  the first company, never deletes it), but it's a one-line
  inconsistency worth cleaning up: a fresh install legitimately can have
  zero companies, so "you must keep at least one" is no longer quite
  the right rule.

## Worth doing eventually

- **Auto-update mechanism.** Tauri has a built-in updater
  (`tauri-plugin-updater` family) that can check a hosted JSON manifest
  and silently download/install new versions. Not set up yet — updates
  currently mean manually rebuilding and re-running the installer on
  each shop PC. Worth doing once there's an actual hosting location
  (e.g. a GitHub repo's Releases page) to publish update manifests to.
- **Automated backup scheduling.** The backup feature
  (zip the database + invoices + exports) exists and works, but is
  manually triggered from the Backup page. A scheduled daily backup
  (e.g. via Windows Task Scheduler, or a simple in-app timer) would
  reduce the risk of a shop owner forgetting to back up before, say,
  reinstalling Windows.
- **WebView2 minimum version check.** Tauri can be configured to
  prompt for a WebView2 update if the installed version is too old
  (`minimumWebview2Version` in `tauri.conf.json`) — not currently set,
  since both target shop PCs are confirmed modern enough that this
  hasn't been a practical issue, but worth adding defensively before
  distributing to any additional shop in the future with an unknown
  Windows version.
- **Tests for the new first-run flow.** `CompanySetup.tsx`,
  `CompanySetupGate.tsx`, and `BackendReadyGate.tsx` are new and were
  verified via TypeScript compilation, production builds, and backend
  curl tests during this migration — but the existing `frontend/`
  project has a `vitest` setup (per `package.json`) that these new
  components don't yet have dedicated tests in.

## Architectural notes for whoever picks this up next

- The Rust code in `src-tauri/` (main.rs, sidecar.rs, commands.rs) was
  written carefully against the documented Tauri v1 API, but **was
  never compiled** during this migration (no Rust toolchain was
  available in the environment it was built in). It's the one part of
  this entire migration most likely to need a small fix on first
  `cargo tauri dev` — bring the exact compiler error if one appears, it
  should be a quick, precise fix rather than a redesign.
- If migrating to Tauri v2 is ever considered: the `allowlist`-based
  config in `tauri.conf.json` and the `tauri::api::process` Rust module
  used in `sidecar.rs` are both Tauri v1-specific APIs. v2 restructured
  permissions into a `capabilities/` folder system and moved sidecar
  spawning to `tauri_plugin_shell`. This would be a deliberate, scoped
  upgrade, not a drop-in version bump.
