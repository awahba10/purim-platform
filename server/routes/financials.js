const router = require('express').Router();
const { pool } = require('../db');

// All financial figures are derived live from orders. Nothing is stored here.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT price, cost, payment_status FROM orders'
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
      totalOrders: rows.length,
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
