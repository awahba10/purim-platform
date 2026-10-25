# Purim Platform

A simple web app for managing holiday tray orders for a community giveaway.

Ten tabs down the left side (the sidebar is always visible):

| Tab | What it does |
| --- | --- |
| **Home** | A plain navigation hub — a grid of buttons, one per tab, and nothing else. The default landing page. The sidebar stays visible everywhere; this is just a bigger set of shortcuts. |
| **New Order** | Customer info (name, phone, way of contact, optional **Payment Method** chips — Cash / Zelle / Venmo / Card / Check / Other, where Other requires typing the method) plus one or more products built on the spot. Each product entry is grouped into three blocks: **1 · Product Details** (preset picker, name, a separate **Tray** chip — limiting-stock trays only, with "N left", auto-filled from a preset's anchor tray, clearable — then the materials picker, which lists only regular materials, auto-suggested overridable cost, price), **2 · Fulfillment** (Pickup / Delivery toggle; Delivery requires an address, a delivery location — from the Delivery Cost list or a new one typed in — optional delivery instructions, and a delivery charge from quick buttons $0/$5/$10/$15/Other; Pickup skips all of it), and **3 · Optional Add-ons** (recipient name, gift message, maker notes — each behind its own toggle, and must be filled if turned on). Start a product from a **premade preset** or **Duplicate** an entry. A running summary shows every product, the product charge, the delivery charge, and the grand total. A ticket number is assigned on submit. |
| **All Orders** | Spreadsheet-style list, one row per order. Sort/search; click a row for full detail. **Payment status** is manual: **Paid / Partially Paid / Not Paid**; **Payment Method** has its own column and is editable in the order detail, where Payment, Payment Method, Production and Delivery sit in a vertical stack of labeled rows. **Production status** (None/Some/All Made) auto-calculates from the products' Made flags; **Delivery status** (None/Some/All Delivered) auto-calculates from the products' Delivered flags (set in a batch) — each is independently overridable with an **Auto** button. A collapsible **Filters** panel (Contact Method, Payment Status, Payment Method, Production / Delivery Status) narrows the list. Press **Select** for selection mode (click a row, shift-click for a range); an action bar offers **Mark Paid / Partially Paid / Not Paid**, **Set Payment Method**, **Export CSV** (selected only), **Delete** (confirms the order and product count; stock goes back), and **Cancel**. The header **Export CSV** downloads every order regardless of the on-screen search/filter/sort. |
| **Products** | Every product from every order — one row each. Editable in place (same record the order shows). A **Batch** column near the end shows a chip — "Assign to Batch" when unassigned, the batch name when assigned — that opens a popup to pick/change/create a batch. A collapsible **Filters** panel (Product Name, Pickup/Delivery, Location, Gift Label, Shipping Label, Delivery Batch — including an **Unassigned** chip) narrows the list. Press **Select** for selection mode: click a row to select it, shift-click for a range; an action bar then offers **Delete**, **Export Gift Labels**, **Export Shipping Labels**, and **Create Batch**. Label PDFs: pick the first empty slot on a partly-used Avery sheet, confirm, download (picked products are marked printed). The **⚙** button opens **Label Settings**. **Export CSV** downloads every product row. |
| **Production** | Grouped by product name, same shape as Delivery Batches. The overview lists every product name with tallies aggregated across every order: Total, then Made, Delivered, Gift Label printed and Shipping Label printed, each as a fraction of the total (e.g. 13 / 17). Click a row to open that product's detail — one card per ticket showing ticket number, customer (and recipient), the maker **Notes** ("No notes" if none), and the materials used, each with a **Mark made / Mark not made** toggle. Long materials lists collapse to the first three with a **show all** link. No filters — it's already grouped. |
| **Materials** | List of supplies with a stock count and a per-unit **cost**. Add / edit any row. Bulk-bought items that cap sales (trays) can be flagged **Limiting stock** (shown with a "Limiting" tag) and given a **Starting quantity** — how many were bought; current stock still drops automatically as products are ordered. The list is split into **Limiting Stock (Trays)** (tinted, at the top) and **Other Materials**; toggling the flag moves a row. Zero or negative stock shows in red with a chip ("Need to buy" / "Sold out"). Regular materials never block an order and may go negative; **trays can never go below zero** anywhere (orders, product edits, manual edits). |
| **Premade Products** | Reusable product presets (name, materials + quantities, auto-summed cost, price). Each can have an **Anchor tray** (chip popup listing only limiting-stock materials; picking one adds it to the materials at qty 1). The **Inventory** column is derived from the anchor tray's remaining stock — presets sharing a tray show the same number; no anchor shows "—". In the **Select Preset** menu each preset shows "N left"; sold-out presets are greyed out and can't be picked. If an order (or an edited product) needs more trays than remain, an inline error says how many are left and saving is blocked until it's reduced; the server enforces the same rule. |
| **Delivery Cost** | Reference list of delivery locations, each with a name and a cost figure. Purely informational — the cost is never applied automatically; only the names feed the New Order location picker. Add / edit any row. |
| **Delivery Batches** | Group products into a delivery run. The overview lists every batch (each row has a **Share** button). Inside a batch, each product is a one-line card (the whole card scrolls sideways as one unit on a phone): ▲ ▼ move / drag, position number, Delivered toggle, **address (bold — tap it to copy)**, product name, ticket, delivery instructions ("No instructions" if none), then a batch chip (reassign) and an ✕ to drop it from the batch. Reorder by dragging (long-press first on a touchscreen) with a live drop-position line, by ▲ ▼, or both. Materials aren't shown here. **Open Route in Maps** builds one Google Maps multi-stop directions link with every address in the current order; **Share** sends the batch's link (native share sheet on mobile, copy-to-clipboard on desktop). |
| **Financials** | Computed live from every product. A collapsible **Filters** panel (Product Name, Pickup/Delivery, Location) applies to the whole tab. Summary cards: total orders, total products sold, **total delivery income**, average order value, profit margin %, average products per order, revenue (paid / not paid / total), profit (paid / not paid / total). Below: **By Product** and **By Location** breakdown tables; bar graphs **Orders by Product Name** and **Orders by Location** (Count / Revenue / Profit toggle), **Orders by Price Point** ($10 ranges, built from the data; a boundary price goes in the higher range), **Revenue by Payment Method** ("Not set" when blank), **Orders by Day**; **Sell-through** — a **Total Sell-through** summary across all trays, then one row per limiting tray (sold / starting, %, remaining, products sold on it — sold = starting − current stock, so it's overall, not filtered); **Top Customers** (2+ orders, matched by name + phone). **Export CSV** / **Export PDF** (top right) reflect the active filters; the PDF lists the filters and includes cards, tables and charts. Nothing to type here. |

### Trays vs. materials

A tray is still stored as one of a product's materials (so it counts in the
cost and its stock moves exactly as before); it's just picked and shown
separately. Materials pickers (New Order, product edit, preset editor) list
only regular materials; trays are chosen in the **Tray** field (products) or
**Anchor tray** (presets). Everywhere materials are listed, the tray appears
on its own **Tray** line above the regular materials. The Products CSV has
separate Tray and Materials columns.

### Seasons

Everything is saved by season (e.g. "Purim 2027"). A season is **Active** or
**Closed**; only one is Active at a time.

- **Per season:** orders and their products, delivery batches, ticket numbers
  (restart at T-0001 each season), label-printed flags, all financials, and
  material stock counts (incl. each tray's starting quantity).
- **Shared by all seasons:** the materials list (names, costs, Limiting flag),
  premade products (incl. anchor tray), Delivery Cost locations, and label
  sheet settings. Products keep their own saved cost and price, so past
  financials never change.
- **Switcher:** the season chip in the sidebar, under Financials, lists all
  seasons and switches the whole app. The app opens on the newest Active season; a choice
  made with the switcher is remembered for that browser tab (refreshes and
  navigation keep it).
- **New Season…** (in the switcher) asks for a name, closes the Active season,
  and starts an empty one with all stock at 0. An empty, non-active season
  (no orders, no batches) can be deleted from the same menu; seasons with any
  data can't be.
- **Closed seasons are read-only**, enforced by the server: a banner at the
  top of the page offers
  **Unlock to edit** (until you switch seasons, reload, or click **Lock
  again**) and **Reopen as active season**. Viewing, filtering and exports
  still work. New Order is off while a closed season is locked. Materials used
  by a past season's products can't be deleted.
- Shared batch links open that batch's season (view-only if it's locked).
  Exports (CSV, PDF, labels) carry the season name in the file name / header.
- **Migration:** on the first start after seasons were added, every existing
  order, product, batch and stock count was assigned to "Purim 2027" (nothing
  deleted or renumbered). The counts check is saved at `/api/seasons/migration`.

### Filters

Products, All Orders, and Financials share one collapsible **Filters** panel. Each
category (e.g. Location, Payment) is its own collapsible group, collapsed by
default; expanding it shows selectable chips. Multiple chips in one category = OR
("Brooklyn" or "Deal"); multiple categories combine = AND (intersection).
Categories fed by other tabs — Location from Delivery Cost, Delivery Batch from
Delivery Batches — pick up new entries automatically the next time you open the
tab; nothing to sync by hand.

### URLs

Every view has its own address (React Router, no auth): `/home`, `/new-order`,
`/orders`, `/orders/:id` (opens that order's detail), `/products`, `/production`,
`/production/:name` (one product's tickets), `/materials`, `/premade`,
`/delivery-cost`, `/batches`, `/batches/:id` (a single batch), `/financials`.
`/` redirects to `/home`.
Refresh and browser back/forward work. Express serves `index.html` for any
non-`/api` path so deep links resolve.

### Inventory logic

Products are created inside an order (the Premade Products tab is only a template
and never touches stock). When an order is created, every material used by every
product in it has its stock reduced by the quantity used. Editing a product's
materials moves stock back and forth to match, and deleting a product or a whole
order returns its materials to stock.

### Order status

Two independent, auto-calculated order statuses (plus the separate manual
Paid / Not Paid):

- **Production** — from each product's Made / Not-made flag (toggled on Products or
  in the order): **None Made** / **Some Made** / **All Made**.
- **Delivery** — from each product's Delivered / Not-delivered flag (toggled inside
  the product's batch): **None Delivered** / **Some Delivered** / **All Delivered**.

Either can be manually set to a specific value (freezing it as an override); the
**Auto** button clears the override so it tracks the products again.

### Label export

The Products tab generates print-ready label PDFs client-side (jsPDF):

- **Shipping labels** (default Avery 5160, 1" × 2-5/8") — plain black text: ticket
  ID, recipient (customer name if no recipient), delivery location, address,
  delivery instructions. Text auto-shrinks to fit.
- **Gift labels** (default Avery 94101, 3" × 3") — a fixed background image
  (`client/src/assets/gift-label-template.png`, copied from
  `Gift-Label-Template.PNG`). Into the clear centre band it prints, in **Dancing
  Script** (bundled at `client/src/fonts/DancingScript-Regular.ttf`, OFL): a
  `To: … From: …` line (`To:` is dropped when there's no recipient name) that
  shrinks to fit one line down to a readable floor and, only if it still won't
  fit, splits cleanly onto two lines (`To: …` / `From: …`); then the gift message
  — the product's own message, or `Chag Purim Sameach!` if none was entered. Text
  never clips or overlaps; the image is never touched.

Sheet geometry (page size, label size, columns, rows, margins, gaps — all in
inches) lives in the `label_templates` table, editable from the **⚙ Label
Settings** panel with no code change. Before each export you pick the first empty
slot so partly-used sheets aren't wasted, then confirm the list. Every exported
product's matching **Gift/Shipping label printed** flag flips on automatically and
can be clicked back off if a print jams.

## Tech

- **Backend:** Node.js + Express (`server/`)
- **Frontend:** React + Vite (`client/`)
- **Database:** PostgreSQL

The database schema is created automatically on server start (`server/schema.sql`),
and a few sample materials are seeded the first time the `materials` table is empty.

## Run it locally

### 1. Install prerequisites

- **Node.js 18+** — https://nodejs.org (the "LTS" download)
- **A PostgreSQL database.** Two ways:
  - **Easiest (no install):** use the free [Neon](https://neon.tech) database you
    set up for deployment (see [DEPLOY.md](DEPLOY.md) Part 2) for local dev too.
  - **Local install:** https://postgresapp.com — download, drag to Applications,
    click "Initialize"; or `brew install postgresql@16 && brew services start postgresql@16`.

### 2. Get a database URL

- **Neon:** copy the connection string from the Neon dashboard.
- **Local install:** run `createdb purim_platform`; the URL is
  `postgresql://localhost:5432/purim_platform`.

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set `DATABASE_URL` to the URL from step 2. SSL is turned on
automatically for hosted databases (Neon) and off for `localhost`.

### 4. Install dependencies

```bash
npm install
npm --prefix client install
```

### 5. Start it

```bash
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3001/api

`npm run dev` runs the API and the React dev server together. The React app proxies
`/api` calls to the backend automatically.

## Production build (what Render runs)

```bash
npm run build   # builds the React app into client/dist
npm start       # Express serves the API AND the built React app on one port
```

## Deploying

See **[DEPLOY.md](DEPLOY.md)** for a step-by-step walkthrough: free GitHub, Neon
(database), and Render (app) accounts, and putting this online permanently at no
cost.
