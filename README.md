# Purim Platform

A simple web app for managing holiday tray orders for a community giveaway.

Five tabs down the left side:

| Tab | What it does |
| --- | --- |
| **New Order** | Form to add a tray order (name, address, phone, Instagram, product, notes, gift message). |
| **All Orders** | Spreadsheet-style list. Sort any column, search by name / phone / Instagram, click a row for full detail. Each order has a **Payment status** (Not Paid / Paid) and a **Progress status** (Not Made / Made / Delivered), both changed with one click. The whole order is editable. |
| **Materials** | List of supplies with a stock count. Add a custom material; edit any row. |
| **Products** | List of trays with stock, cost to make, sell price, and the materials each one uses. Add / edit products and tick the materials they consume. |
| **Financials** | Auto-updating dashboard: total orders, revenue (paid / not paid / total), profit (paid / not paid / total). Nothing to type here. |

### Inventory logic

When an order is created, the app decreases that product's stock by 1 and decreases
every linked material by the amount that product uses. Editing an order to a
different product moves the stock back and forth accordingly, and deleting an order
returns its stock.

## Tech

- **Backend:** Node.js + Express (`server/`)
- **Frontend:** React + Vite (`client/`)
- **Database:** PostgreSQL

The database schema is created automatically on server start (`server/schema.sql`),
and a few sample materials/products are seeded the first time the `materials` table
is empty.

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
