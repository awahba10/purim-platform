const router = require('express').Router();
const { pool } = require('../db');

// Everything is derived live. One order can hold many products, so revenue and
// profit are summed across every product, split by its order's payment status.
router.get('/', async (req, res, next) => {
  try {
    const { rows: orderCount } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM orders'
    );
    const { rows } = await pool.query(
      `SELECT o.payment_status, p.price, p.cost
         FROM products p
         JOIN orders o ON o.id = p.order_id`
    );

    let paidRevenue = 0;
    let notPaidRevenue = 0;
    let paidProfit = 0;
    let notPaidProfit = 0;

    for (const r of rows) {
      const price = Number(r.price);
      const profit = price - Number(r.cost);
      if (r.payment_status === 'Paid') {
        paidRevenue += price;
        paidProfit += profit;
      } else {
        notPaidRevenue += price;
        notPaidProfit += profit;
      }
    }

    res.json({
      totalOrders: orderCount[0].n,
      totalProductsSold: rows.length,
      revenue: {
        paid: paidRevenue,
        notPaid: notPaidRevenue,
        total: paidRevenue + notPaidRevenue,
      },
      profit: {
        paid: paidProfit,
        notPaid: notPaidProfit,
        total: paidProfit + notPaidProfit,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
