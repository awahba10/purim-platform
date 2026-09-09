# Purim Platform

A simple web app for managing holiday tray orders for a community giveaway.

Eight tabs down the left side:

| Tab | What it does |
| --- | --- |
| **New Order** | Customer info (name, phone, way of contact) plus one or more products built on the spot. Each product entry is grouped into three blocks: **1 · Product Details** (preset picker, name, materials with quantities, auto-suggested overridable cost, price), **2 · Fulfillment** (Pickup / Delivery toggle; Delivery requires an address, a delivery location — from the Delivery Cost list or a new one typed in — optional delivery instructions, and a delivery charge from quick buttons $0/$5/$10/$15/Other; Pickup skips all of it), and **3 · Optional Add-ons** (recipient name, gift message, maker notes — each behind its own toggle, and must be filled if turned on). Start a product from a **premade preset** or **Duplicate** an entry. A running summary shows every product, the product charge, the delivery charge, and the grand total. A ticket number is assigned on submit. |
| **All Orders** | Spreadsheet-style list, one row per order. Sort/search; click a row for full detail. **Payment status** (Not Paid / Paid) is manual. **Production status** (None/Some/All Made) auto-calculates from the products' Made flags; **Delivery status** (None/Some/All Delivered) auto-calculates from the products' Delivered flags (set in a batch) — each is independently overridable with an **Auto** button. **Export CSV** (top-right) downloads every order regardless of the on-screen search/sort. |
| **Products** | Every product from every order — one row each. Editable in place (same record the order shows). A **Batch** column near the end shows a chip — "Assign to Batch" when unassigned, the batch name when assigned — that opens a popup to pick/change/create a batch. Press **Select** for selection mode: click a row to select it, shift-click for a range; an action bar then offers **Delete**, **Export Gift Labels**, **Export Shipping Labels**, and **Create Batch**. Label PDFs: pick the first empty slot on a partly-used Avery sheet, confirm, download (picked products are marked printed). The **⚙** button opens **Label Settings**. **Export CSV** downloads every product row. |
| **Materials** | List of supplies with a stock count and a per-unit **cost**. Add / edit any row. |
| **Premade Products** | Reusable product presets (name, materials + quantities, auto-summed cost, price). A speed shortcut for New Order only — no stock, not part of order/inventory logic. |
| **Delivery Cost** | Reference list of delivery locations, each with a name and a cost figure. Purely informational — the cost is never applied automatically; only the names feed the New Order location picker. Add / edit any row. |
| **Delivery Batches** | Group products into a delivery run. The overview lists every batch (each row has a **Share** button). Inside a batch, each product is a one-line card: ▲ ▼ move / drag, position number, Delivered toggle, **address (bold)**, product name, ticket, delivery instructions ("No instructions" if none), then a batch chip (reassign) and an ✕ to drop it from the batch. Reorder by dragging (long-press first on a touchscreen) with a live drop-position line, by ▲ ▼, or both. Materials aren't shown here. **Open Route in Maps** builds one Google Maps multi-stop directions link with every address in the current order; **Share** sends the batch's link (native share sheet on mobile, copy-to-clipboard on desktop). |
| **Financials** | Auto-updating dashboard: total orders, total products sold, **total delivery income**, revenue (paid / not paid / total), profit (paid / not paid / total). Nothing to type here. |

### URLs

Every view has its own address (React Router, no auth): `/new-order`, `/orders`,
`/orders/:id` (opens that order's detail), `/products`, `/materials`, `/premade`,
`/delivery-cost`, `/batches`, `/batches/:id` (a single batch), `/financials`.
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
