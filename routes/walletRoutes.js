const express = require('express');
const router = express.Router();
const { sql } = require('../config/db');
const { protect } = require('../middleware/auth');
const { authenticateToken } = require('../middleware/auth');
const { poolPromise } = require('../config/db');



// 🔹 Get wallet balance
router.get('/balance/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;  // From auth token, not req.params!
    // Or if you want to allow userId param to override (less secure)
    // const userId = req.params.userId || req.user.userId;


    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, userId)
      .query('SELECT wallet FROM Users WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ balance: result.recordset[0].wallet });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/add-payment', authenticateToken, async (req, res) => {
  const { amount, method, reference } = req.body;
  const userId = req.user.userId;

  console.log('Attempting payment insert:', { userId, amount, method, reference });

  try {
    const pool = await poolPromise;

    // ✅ Verify user exists
    const userExists = await pool.request()
      .input('id', sql.Int, userId)
      .query('SELECT 1 FROM Users WHERE id = @id');

    if (userExists.recordset.length === 0) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // ✅ Insert payment
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('amount', sql.Int, amount)
      .input('method', sql.NVarChar(50), method)
      .input('status', sql.NVarChar, 'pending')
      .input('referenceCode', sql.NVarChar(100), reference || null)
      .query(`
        INSERT INTO Payments (userId, amount, method, status, referenceCode, createdAt)
        OUTPUT INSERTED.id
        VALUES (@userId, @amount, @method, @status, @referenceCode, GETDATE());
      `);

    const newId = result.recordset[0].id;
    console.log('✅ Successfully inserted payment ID:', newId);

 res.status(200).json({
      message: '🕓 جاري التحقق من عملية الدفع',
      status: 'pending',
      paymentId: result.recordset[0].id,
    });

  } catch (err) {
    console.error('❌ Error inserting payment:', err);
    return res.status(500).json({ error: 'حدث خطأ أثناء إرسال العملية. الرجاء المحاولة لاحقًا.' });
  }
});

// 🔹 Get payment history
router.get('/history/:userId', async (req, res) => {
  const userId = req.params.userId; // ✅ Correct here

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT id, userId, amount, method, status, referenceCode AS reference, createdAt
        FROM Payments
        WHERE userId = @userId
        ORDER BY createdAt DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to load transaction history' });
  }
});

module.exports = router;
