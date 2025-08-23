// subscriptionRoutes.js
const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require('../config/db'); 
const { authenticateToken } = require("../middleware/auth");
const User = require("../models/User");

// Mock subscription plans (could be in DB)
const plans = {
  'basic-monthly': { id: 'basic-monthly', name: 'باقة بيسك شهرية', months: 1, price: 50 },
    'plus-monthly':  { id: 'plus-monthly',  name: 'باقة بلس شهرية', months: 1, price: 80 },
    'vip-monthly':   { id: 'vip-monthly',   name: 'باقة VIP شهرية', months: 1, price: 120 },
    'basic-yearly':  { id: 'basic-yearly',  name: 'باقة بيسك سنوية', months: 12, price: 500 },
    'plus-yearly':   { id: 'plus-yearly',   name: 'باقة بلس سنوية', months: 12, price: 800 },
    'vip-yearly':    { id: 'vip-yearly',    name: 'باقة VIP سنوية', months: 12, price: 1200 }
};

router.post('/subscribe', async (req, res) => {
  try {
    const { userId, planId, planName, price, startDate, expiryDate } = req.body;

    const pool = await poolPromise;

   // 1️⃣ Deduct price from user's wallet
    const walletResult = await pool.request()
      .input('userId', sql.Int, userId)
      .input('price', sql.Decimal(10, 2), price)
      .query(`UPDATE Users
              SET wallet = wallet - @price
              WHERE id = @userId;
              SELECT wallet FROM Users WHERE id = @userId;`);

    const newWallet = walletResult.recordset[0].wallet;

    await pool.request()
      .input('user_id', sql.Int, userId)
  .input('planId', sql.NVarChar(50), planId)      // ✅ must be 'planId'
  .input('planName', sql.NVarChar(100), planName) // ✅ must be 'planName'
  .input('price', sql.Decimal(10,2), price)
  .input('start_date', sql.DateTime, startDate)
  .input('expiry_date', sql.DateTime, expiryDate)
  .input('status', sql.VarChar, 'active')
  .execute('AddOrUpdateSubscription');

    res.json({
      success: true,
      subscription: {
        planId,
        planName,
        price,
        startDate,
        expiryDate,
        status: 'active',
        wallet: newWallet
      }
    });
  } catch (err) {
    console.error("❌ Subscription error:", err);
    res.status(500).json({ success: false, message: 'Subscription failed', error: err.message });
  }
  });

module.exports = router;
