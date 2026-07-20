# Developer guide

## Architecture

**Companies are dynamic, not hardcoded.** Earlier versions of this codebase
had a `CompanyEnum` with fixed `SA`/`SE` values. That's gone — `company` /
`company_key` are now plain strings everywhere (DB columns, Pydantic
schemas, TypeScript types), and the **Settings table is the source of
truth for which companies exist**. Adding a company is just inserting a
row there (via `POST /settings/companies/create`); every other module
(`Inventory.company_key`, `Invoice.company`) trusts that value without any
code-level enum to update. If you're tempted to add a new hardcoded
company check anywhere, don't — query `Settings` instead.

**Inventory is company-scoped.** Every inventory list/search/create call
takes a `company_key` and only ever touches that company's rows
(`UniqueConstraint("company_key", "item_name")` enforces no duplicate
names within one company, but the same name is fine across companies).

**Backend** follows a layered pattern:

```
API route (app/api/*.py)
   → Repository (app/repositories/*.py)   — raw DB queries, no business rules
   → Service (app/services/*.py)          — orchestration: invoice numbering,
                                             stock deduction, PDF generation
   → Model (app/models/models.py)         — SQLAlchemy ORM tables
```

Routes never talk to the ORM directly except for simple lookups (e.g.
checking a customer exists before deleting). Anything with more than one
step — like creating an invoice, which has to generate a number, save items,
reduce stock, and render a PDF — lives in a service class
(`InvoiceService`).

**Frontend** is plain React + Zustand, no Redux:

- `store/appStore.ts` — cross-page UI state (active company tab, toasts)
- `store/invoiceStore.ts` — the in-progress invoice draft (cleared on save)
- `store/settingsStore.ts` — cached company settings

Each backend module has a matching `services/*Api.ts` file with typed axios
calls. Pages call these directly; there's no extra data-fetching library
(no React Query) since the app is small and offline-first.

## Adding a new field to an existing module

Example: adding a `gst_number` field to customers.

1. **Model** (`backend/app/models/models.py`): add the column to `Customer`.
2. **Schema** (`backend/app/schemas/schemas.py`): add it to `CustomerCreate`,
   `CustomerUpdate`, and `CustomerOut`.
3. Delete `backend/database/smartbill.db` (SQLite has no built-in migration
   here — for production data, use Alembic instead of deleting the file).
4. **Frontend type** (`frontend/src/types/index.ts`): add the field to the
   `Customer` interface.
5. **Form** (`frontend/src/pages/Customers.tsx` or the relevant modal): add
   an input bound to the new field.

## Adding a brand-new module (e.g. "Suppliers")

1. Add the model in `models.py`.
2. Add Pydantic schemas in `schemas.py`.
3. Create `repositories/supplier_repo.py` following the pattern in
   `customer_repo.py`.
4. Create `api/supplier.py` with the route handlers, register it in
   `main.py` with `app.include_router(supplier.router)`.
5. Add `frontend/src/services/supplierApi.ts`.
6. Add `frontend/src/pages/Suppliers.tsx`.
7. Add a sidebar entry in `frontend/src/components/layout/Sidebar.tsx` and a
   route in `frontend/src/App.tsx`.
8. Write pytest tests in `backend/tests/test_supplier.py` (copy
   `test_customer.py` as a starting point — same CRUD shape).

## Database migrations

This build creates tables with `Base.metadata.create_all()` on startup,
which handles brand-new tables but — critically — **does nothing for
columns added to a table that already exists**. SQLite has no migration
tool built in, so the first time a column was added after release
(`Settings.created_at`), anyone with an existing database file hit a hard
crash on startup: `no such column: settings.created_at`.

`app/database/db.py` now has a small auto-migration step
(`_run_column_migrations()`) that runs after `create_all()`: it checks a
list of `(table, column, ddl_type)` tuples against what's actually in the
database, and runs a plain `ALTER TABLE ... ADD COLUMN` for anything
missing. This is safe and non-destructive on SQLite (existing rows get
`NULL`/the column default for the new column; nothing is deleted).

**Whenever you add a new column to an existing model, add it to
`_COLUMN_MIGRATIONS` in the same change** — otherwise everyone with an
existing database file will hit the same crash this was built to prevent.
This was needed for `InvoiceItem.stock_deducted` (added to support exact
stock reconciliation when editing an invoice — see below) and retroactively
fixes the earlier `Settings.created_at` crash too.

For anything beyond simple "add a column with a default" (renaming
columns, changing types, splitting tables), this lightweight approach
isn't enough — reach for **Alembic** instead:

```bash
pip install alembic
alembic init alembic
# point alembic.ini's sqlalchemy.url at sqlite:///./database/smartbill.db
# import Base from app.database.db in alembic/env.py
alembic revision --autogenerate -m "add gst_number to customers"
alembic upgrade head
```

## Editing an invoice — stock reconciliation

`PUT /invoice/{id}` (handled by `InvoiceService.update_invoice()`) lets a
saved invoice's customer, payment mode, remarks, and line items all
change, while keeping the invoice number and date fixed. The tricky part
is inventory: the original `create_invoice()` deducts stock for some
lines and not others (auto-created zero-stock items are skipped), and
there was no way to tell which lines had actually been deducted just by
looking at the invoice afterward — `inventory_id` is set either way.

`InvoiceItem.stock_deducted` (1/0) records this explicitly at save time.
Editing then works in two clean passes:

1. **Reverse**: walk the invoice's *current* items, add `qty` back to
   `inventory.current_stock` for every item with `stock_deducted=1`.
2. **Reapply**: replace the item list with the new one (same resolution
   logic as create — `InvoiceService._resolve_items()`, shared by both
   create and update), then deduct stock fresh for whatever resolves to
   `stock_deducted=1` this time.

Because reversal and reapplication are both driven by the same flag and
the same resolution function, this is safe to call repeatedly on the same
invoice — quantity bumps, item swaps, and removals all net out correctly
with no drift, which is covered by
`test_update_invoice_reconciles_stock_on_quantity_change` and
`test_update_invoice_reconciles_stock_when_item_is_swapped` in
`tests/test_invoice.py`.

On the frontend, `useInvoiceStore.loadFromInvoice()` populates the same
draft used for creating a new invoice, plus `editingInvoiceId` /
`editingInvoiceNumber` fields that `InvoiceForm.tsx` checks to decide
whether `handleSave()` calls `invoiceApi.create()` or
`invoiceApi.update()`. The route `/invoice/:id/edit` (vs `/invoice/new`)
is what triggers `loadFromInvoice()` on mount.

## Why these specific libraries

See section 13 of the original plan document (`billsnap-revised-plan_1.html`)
for the full reasoning table. Short version: SQLite because it's a single
file with no install step, FastAPI for free OpenAPI docs and async support,
ReportLab because invoices need exact, fast, programmatic A4 layout rather
than HTML-to-PDF conversion, openpyxl because the spec calls for real Excel
formatting (bold headers, filters) not just CSV.

## PDF layout: Original + Duplicate on one page

`pdf_service.py` renders the invoice content as a reusable flowable block
(`_build_copy_flowables()`), then calls it twice on a single A4 page — an
"ORIGINAL" copy on the top half and a "DUPLICATE" copy on the bottom half,
separated by a dashed cut line (`_DashedCutLine`). This is the standard
shop-counter convention: one printed sheet, cut in half, gives the
customer their copy while the shop keeps the other — instead of printing
two full pages per invoice.

**The two halves are computed to be provably equal**, not independently
tuned. `PAGE_HEIGHT`, `TOP_MARGIN`, `BOTTOM_MARGIN`, and `CUT_LINE_GUTTER`
(which itself accounts for the cut-line flowable's own height plus the
spacer above and below it) are all real constants; `HALF_HEIGHT =
USABLE_HEIGHT / 2` is derived from them, and both `KeepInFrame` calls in
`generate_invoice_pdf()` use that exact same value. `CUT_LINE_GUTTER` and
the spacers placed around the cut line in `generate_invoice_pdf()` must
add up to the same total — `test_pdf_page_geometry_gives_both_copies_equal_height`
in `tests/test_invoice.py` asserts the reconstructed sum equals
`PAGE_HEIGHT` exactly (within floating-point tolerance), so a future edit
that breaks this arithmetic will fail a test rather than silently
shipping a lopsided or overflowing page.

Each half is wrapped in `KeepInFrame(..., mode="shrink")`, which
auto-shrinks the content to fit the allotted `HALF_HEIGHT` if an invoice
has many line items. This means an invoice with 2 items and one with 24
items both still produce exactly one page — the items table just gets
visually denser rather than overflowing onto a second page. If you ever
need a true second page for very long invoices instead of shrinking
further, change `mode="shrink"` to `mode="truncate"` and add page-break
logic, but be aware that breaks the "always one sheet" guarantee this was
built for.

The signature block (`sig_table` near the end of `_build_copy_flowables()`)
gets deliberately generous spacing — an 8mm `Spacer` before the signature
lines themselves (room to actually sign by hand) and 2mm between the line
and the printed name below it. If this ever feels cramped again on a
longer invoice, increase those two values rather than the overall
`HALF_HEIGHT` budget, since the budget is shared and derived from page
geometry as described above.

**Grand total rounding**: the PDF prints `invoice.grand_total` rounded to
the nearest whole rupee via `_round_rupees()`, which uses `Decimal(...).
quantize(..., rounding=ROUND_HALF_UP)` — deliberately **not** Python's
built-in `round()`, which uses banker's rounding (round-half-to-even) and
would round an amount like 1416.50 down to 1416 instead of up to 1417.
That's correct for statistical aggregates but wrong for a customer-facing
bill, where a `.50` should always round up the way a till or printed
invoice does in practice. The *stored* `grand_total` in the database/API
keeps full decimal precision always — only the printed PDF rounds, so
reports and Excel exports stay accurate. If you ever need to round
currency anywhere else in the codebase (a new report total, a different
export), reuse `_round_rupees()` rather than calling `round()` directly.

The heading text ("Cash Memo / Delivery Challan") is a single constant,
`INVOICE_HEADING` at the top of `pdf_service.py` — change it there if the
wording needs to differ later.

## Payment mode: backend field kept, frontend selector removed

`Invoice.payment_mode` still exists as a database column and still
appears in `/invoice/list`, the Excel export, and the daily report's
payment-mode breakdown — those are legitimate reporting uses unrelated to
what's printed on the invoice document, and the PDF stopped printing a
"Mode: X" line a couple of rounds back anyway. What changed this round is
that the **New Invoice form no longer has a Payment Mode selector at
all** — `InvoiceForm.tsx` dropped the `<select>` and the `PAYMENT_MODES`
constant entirely. New invoices now silently save with `payment_mode:
'Cash'` (the store's default in `invoiceStore.ts`), and **editing an
invoice preserves whatever its original payment_mode was** (set via
`loadFromInvoice()`) since there's no control to change it anymore. If a
payment-mode selector needs to come back later — e.g. if the printed
invoice changes to need it again — re-add the `<select>` bound to
`paymentMode`/`setPaymentMode` (both still present in the store, just
unused by the UI), no backend change required.

## PDF download and print mechanics

The backend exposes two separate endpoints for the same PDF file:

- `GET /invoice/{id}/pdf/file` — sets `Content-Disposition: attachment`,
  which forces the browser to save the file rather than display it. Used
  for the Download button.
- `GET /invoice/{id}/pdf/view` — sets `Content-Disposition: inline`, which
  opens the browser's native PDF viewer. Used for the Print button.

This split matters: FastAPI's `FileResponse(..., filename=...)` defaults
to `inline` even when a filename is supplied, so a single endpoint can't
serve both purposes correctly — the `Content-Disposition` header has to be
set explicitly per use case.

On the frontend, `invoiceApi.downloadPdf()` does **not** use a plain
`<a href="...cross-origin-url..." download>`. Browsers only honor the
`download` attribute for same-origin links, and the API (`localhost:8000`)
and frontend (`localhost:1420`) are different origins — so that pattern
silently fails (the browser just navigates instead of saving). Instead it
`fetch()`es the bytes itself and saves them via a `blob:` URL, which is
always same-origin regardless of where the original bytes came from.

`invoiceApi.printPdf()` does **not** use `window.open(url)` plus a `load`
listener either — when the browser's native PDF viewer handles the
response in a popup, that popup is a plugin/viewer rather than a normal
HTML document, and its `load` event frequently never fires, so `print()`
is never called. Instead it loads the PDF into a hidden same-page
`<iframe>` and calls `.print()` on that iframe's `contentWindow`, with a
timed fallback in case the iframe's own `onload` doesn't fire reliably
(which also varies by browser for embedded PDFs).

If you add more PDF-producing features later (e.g. a "print all today's
invoices" button), follow the same `/pdf/file` + `/pdf/view` split rather
than trying to reuse one endpoint for both.

**Any future downloadable file follows this same pattern.** Backup ZIPs
hit the identical bug: `GET /backup/download/{filename}` originally relied
on `FileResponse`'s default `Content-Disposition` (inline), and the
frontend used the same cross-origin `<a download>` anti-pattern. So did
Excel exports — `POST /export/excel` only ever returned a JSON path
string; there was no endpoint at all that served the file's bytes until
`GET /export/excel/download` was added. All three are now fixed the same
way — explicit `attachment` header server-side, `fetch()` + `blob:` URL
client-side (`backupApi.download()` and `exportApi.download()` in
`reportApi.ts`). If you add another exportable file type, copy this
pattern rather than reinventing it; the cross-origin `<a download>` link
will look like it works in local testing on some browsers and silently
fail in others, which is how this bug shipped three times.

Note that `GET /export/excel/download` takes the file path as a query
parameter (since exports are organized into dated subfolders, unlike
backups which are flat filenames), so it normalizes and validates that the
resolved path stays inside `exports/` before serving anything — without
that check, a path like `../database/smartbill.db` would let the endpoint
serve arbitrary files from the server's disk. If you add a similar
path-based download endpoint, copy that containment check too.

## Logo

`components/shared/Logo.tsx` is a self-contained SVG mark (no image
assets, no external font) — a receipt shape with a torn/zig-zag bottom
edge and a lightning bolt cut through it, on a blue gradient rounded-square
badge. Takes a `variant` prop: `'mark'` for icon-only (used for the
favicon, embedded as a matching inline SVG data URI in `index.html` since
there's no build step that processes a separate favicon file), or `'full'`
for icon + wordmark (used in the sidebar header). If you need the mark at
a different size, pass `size` — it's just a `viewBox`, scales cleanly.

## Invoice preview modal

`components/invoice/InvoicePreviewModal.tsx` shows the actual rendered PDF
(via an `<iframe src={pdfViewUrl}>`) rather than a plain "saved
successfully" message, with Print and Download buttons in its header. It's
shared between two call sites:

- `InvoiceForm.tsx` — opens automatically right after a new invoice saves.
- `InvoiceHistory.tsx` — opens when the person clicks "Preview PDF" on a
  past invoice (the line-item table modal there is unchanged and still
  useful as a fast text view; the PDF preview is an addition, not a
  replacement).

If you need a preview elsewhere, reuse this component rather than building
another print/download button pair — it already handles the iframe key
remount (so switching between two invoices' previews doesn't show a stale
PDF) and routes errors through the `onError` callback into the caller's
toast system.

## Testing philosophy

- **Repositories** are not unit-tested directly — they're thin enough that
  the API-level tests in `tests/test_*.py` cover them through the route.
- **Services** with real logic (`InvoiceService`, the invoice number
  generator) are exercised indirectly through `test_invoice.py`, which
  checks the generated number format and the per-company-per-day counter
  reset.
- Frontend tests use Vitest + Testing Library for components (`DataTable`,
  `StatCard`) and pure Zustand store logic (`invoiceStore`). Pages that are
  mostly API-call wiring are not unit-tested — they're straightforward
  enough that a type error or broken import would already fail `tsc -b`.
