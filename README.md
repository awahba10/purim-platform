# Purim Platform

A simple web app for managing holiday tray orders for a community giveaway.

Seven tabs down the left side:

| Tab | What it does |
| --- | --- |
| **New Order** | Customer info (name, phone, way of contact) plus one or more products built on the spot. Each product carries a **Pickup / Delivery** tag. Delivery products ask for a required address, a delivery location (pick from the Delivery Cost list or type a new one), and a delivery charge chosen from quick buttons ($0/$5/$10/$15/Other). Pickup products skip all three. Each product also has notes, a gift message, and materials (tap-to-add chips with a quantity each); cost is auto-suggested from the materials but overridable, price is separate. Start a product from a **premade preset** or **Duplicate** an entry. A running summary shows every product, the product charge, the delivery charge, and the grand total. A ticket number is assigned on submit. |
| **All Orders** | Spreadsheet-style list, one row per order. Sort/search; click a row for full detail. **Payment status** (Not Paid / Paid) is manual. **Progress status** — None Made / Some Made / All Made / Delivered — is auto-calculated from the products' Made state and overridable (with an **Auto** button). **Export CSV** (top-right) downloads every order regardless of the on-screen search/sort. |
| **Materials** | List of supplies with a stock count and a per-unit **cost**. Add / edit any row. |
| **Premade Products** | Reusable product presets (name, materials + quantities, auto-summed cost, price). A speed shortcut for New Order only — no stock, not part of order/inventory logic. |
| **Delivery Cost** | Reference list of delivery locations, each with a name and a cost figure. Purely informational — the cost is never applied automatically; only the names feed the New Order location picker. Add / edit any row. |
| **Products** | Every product from every order — one row each, tagged with its ticket. Columns include Made toggle, Pickup/Delivery type, delivery location, address, and delivery charge. Editable in place (same record the order shows). **Export CSV** downloads every product row. |
| **Financials** | Auto-updating dashboard: total orders, total products sold, **total delivery income**, revenue (paid / not paid / total), profit (paid / not paid / total). Nothing to type here. |

### Inventory logic

Products are created inside an order (the Premade Products tab is only a template
and never touches stock). When an order is created, every material used by every
product in it has its stock reduced by the quantity used. Editing a product's
materials moves stock back and forth to match, and deleting a product or a whole
order returns its materials to stock.

### Order progress

Each product has a Made / Not-made flag. An order's progress is derived from its
products: **None Made** (zero made), **Some Made** (a mix), **All Made** (all made).
Setting any value manually — including **Delivered** — freezes it as an override;
the **Auto** button clears the override so it follows the products again.

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
