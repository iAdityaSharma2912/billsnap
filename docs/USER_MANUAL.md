# BillSnap — user manual

A quick guide for billing staff, store managers, and owners.

## Starting the app

Open BillSnap from the Start Menu or Desktop shortcut, same as any other
Windows program — no commands, no terminals. The first time it opens
after install, it'll ask you to set up your business (name, address,
phone, and optionally UPI/bank details) before showing the main screen.

## Creating an invoice

1. Click **New invoice** in the sidebar, or press `Ctrl+N` from anywhere.
2. Pick the company at the top.
3. In the customer box, start typing a name or phone number. Existing
   customers show up in a dropdown — click one to fill in their phone and
   address automatically. If they're new, type their name and click
   **"+ Create new customer"** at the bottom of the dropdown.
4. In the item row, start typing an item name (e.g. "rr" for RR Cable).
   Matching items from that company's inventory appear instantly — click
   one to fill in the unit and price. If the item is brand new and doesn't
   match anything, that's fine too — just type its name, unit, and rate;
   it gets added to that company's inventory list automatically (at zero
   stock) so it shows up in autocomplete next time you bill it.
5. Adjust the quantity, then press **Enter** to add the row and start a
   new one. The grand total updates automatically as you add items.
6. Click **Save & generate PDF** (or press `Ctrl+S`). The invoice number is
   assigned automatically and a preview of the actual invoice PDF opens —
   you can see exactly what was generated before doing anything with it.
   From that preview, click **Print** to print it right away or
   **Download** to save it to your computer. Close the preview when you're
   done to go to the invoice in history.

**About the printed page:** every invoice prints as **one A4 sheet**,
divided into two **equal halves** — an "ORIGINAL" on top and a
"DUPLICATE" on the bottom — with a dashed cut line exactly down the
middle. Print it, cut along that line, give the customer their half, and
keep the other for your records. This uses half the paper of printing two
separate pages. Each copy has the heading underlined, the customer's name
in a larger bold font so it's easy to spot at a glance, the grand total
rounded to the nearest whole rupee, and generously spaced signature lines
for the customer (bottom-left) and your business (bottom-right) at the
end.

## Editing an invoice

Made a mistake — wrong quantity, wrong item, wrong customer? Go to
**Invoice history**, open the invoice, and click **Edit**. You'll land
back on the invoice form with everything already filled in. Change
whatever needs changing — customer, remarks, or any line item — and click
**Save changes & regenerate PDF**.

A few things to know about editing:
- The **invoice number and date stay exactly the same** — editing a
  mistake shouldn't make it look like a separate sale happened.
- The **company can't be changed** while editing (shown grayed out). If an
  invoice needs to move to a different company entirely, delete it and
  create a fresh one there instead.
- **Stock adjusts automatically.** If you originally billed 20 units and
  edit it to 35, only the extra 15 units are deducted from inventory — and
  if you swap an item out entirely, the old item's stock is restored and
  the new item's stock is deducted, so nothing gets double-counted no
  matter how many times you edit the same invoice.
- The PDF is regenerated immediately, so the preview, print, and download
  always reflect the latest saved version.

## Finding a past invoice

Go to **Invoice history** in the sidebar. The list shows the customer name
right alongside each invoice number, so you don't have to open anything to
see who it was for. Filter by company and by date range (Today / This
week / This month / All time). Click any row to see the full line items,
then click **Edit** to make changes, or **Preview PDF** to see the actual
invoice and use the **Print** or **Download** buttons there any time you
need it again.

## Managing customers

Go to **Customers**. Search by name or phone. Click **+ Add customer** to
create one without going through the invoice screen. Click any row to see
their full purchase history and total spend.

## Managing inventory

Go to **Inventory**. Each company has its own separate item list and stock
— use the tabs at the top to switch between companies. Items below their
minimum stock level are highlighted in red with a warning icon. Click
**+ Add item** to add a new product, or click any row to edit its price,
stock, or category. Stock numbers reduce automatically every time that
item is used (by name or by autocomplete) on a saved invoice for that
company.

## Daily and monthly reports

Go to **Reports**. Switch between the **Daily** and **Monthly** tabs and
pick a date. You'll see total sales, invoice count, top customers, top
items, and a breakdown by payment mode.

## Exporting to Excel

Go to **Export** (or press `Ctrl+E`). Pick a company and date range, then
click **Export to Excel**. The `.xlsx` file is generated and **downloads
straight to your computer's Downloads folder** automatically. If you need
that same file again later without regenerating it, click **Download
again** next to the "Saved to" confirmation.

## Backing up your data

Go to **Backup** (or press `Ctrl+B`) and click **Create & download backup**.
This bundles everything — the database, every invoice PDF, every export —
into one ZIP file and downloads it straight to your computer's Downloads
folder. Do this regularly, especially before any major change to the PC.

To restore from a backup, click **Browse & restore ZIP file**, pick any
previously downloaded BillSnap backup ZIP from your computer, and confirm.
This will overwrite current data, so only do this if you're sure — and
ideally take a fresh backup first in case you need to undo it.

## Adding a new company

Go to **Settings → Companies → Add company**. Give it a short code (a few
letters, used in its invoice numbers — e.g. `GS` for Gupta Stores means
invoices look like `GS-20260624-001`), its name, address, and phone. You
can also fill in UPI ID and bank details right away, or come back to it
later by clicking the company in the list.

The new company shows up immediately everywhere — as a tab on Dashboard,
Inventory, New invoice, and as an option on Invoice history and Export —
with its own separate inventory and invoice numbering. No restart needed.

## Changing a company's details or payment info

Go to **Settings → Companies**, then click the company you want to edit.
You can update the name, address, phone, UPI ID, and bank details here —
anything you enter is automatically printed at the bottom of every invoice
PDF for that company going forward. A company can only be deleted if it
has no invoices yet.

## Viewing logs

Go to **Settings → Logs** for a live viewer of what's been happening in
the app — useful if your admin needs to check what happened on a given
day.

## Keyboard shortcuts (for faster billing)

| Key | What it does |
|---|---|
| `Ctrl+N` | Start a new invoice from any screen |
| `Ctrl+S` | Save the invoice you're working on |
| `Ctrl+E` | Jump to the export screen |
| `Ctrl+B` | Create & download a backup right now |
| `Enter` | While adding an item row, adds it and starts the next one |
| `Esc` | Closes whatever popup/dialog is open |
