# Purim Platform

A simple web app for managing holiday tray orders for a community giveaway.

Five tabs down the left side:

| Tab | What it does |
| --- | --- |
| **New Order** | Customer info (name, phone, way of contact) plus one or more products built on the spot. Each product has its own name, delivery address, notes, gift message, and materials (searchable, with a quantity each). Cost is auto-suggested from the materials but can be overridden; price is separate. A running summary shows every product and the order's total cost and total charge. A ticket number is assigned on submit. |
| **All Orders** | Spreadsheet-style list, one row per order. Sort any column, search by customer / phone / contact / ticket. Click a row for full detail including every product in the order. Order-level **Payment status** (Not Paid / Paid) and **Progress status** (Not Made / Made / Delivered), changed with one click. Order and its products are editable. |
| **Materials** | List of supplies with a stock count and a per-unit **cost**. Add a custom material; edit any row. |
| **Products** | Every product from every order — one row each, tagged with its ticket number, showing its materials, cost, and price. Editable in place; edits are the same record the order shows. |
| **Financials** | Auto-updating dashboard: total orders, total products sold, revenue (paid / not paid / total), profit (paid / not paid / total). Nothing to type here. |

### Inventory logic

Products are created inside an order (there is no premade catalog). When an order is
created, every material used by every product in it has its stock reduced by the
quantity used. Editing a product's materials moves stock back and forth to match,
and deleting a product or a whole order returns its materials to stock.

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
