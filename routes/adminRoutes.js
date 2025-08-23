// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { sql, getPool, config } = require('../config/db');
const bcrypt = require('bcrypt');
const dbConfig = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { poolPromise } = require('../config/db');

// إرجاع عدد المستخدمين
router.get('/user-count', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT COUNT(*) AS count FROM Users');
    res.json({ count: result.recordset[0].count });
  } catch (err) {
    console.error('Error fetching user count:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Get all users
router.get('/users', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT id, name, email, section, phone FROM Users');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Delete user by ID
router.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, userId)
      .query('DELETE FROM Users WHERE id = @id');

    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Create user from admin
router.post('/users', async (req, res) => {
  const { name, email, password, section, phone } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const pool = await poolPromise;

    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('section', sql.NVarChar, section)
      .input('phone', sql.NVarChar, phone)
      .query('INSERT INTO Users (name, email, password, section, phone) VALUES (@name, @email, @password, @section, @phone)');

    res.json({ message: 'تم إنشاء المستخدم بنجاح' });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ message: 'حدث خطأ أثناء إنشاء المستخدم' });
  }
});
// PUT /api/admin/users/:id
router.put('/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { name, email, section, phone } = req.body;

  try {
    const pool = await poolPromise;

    await pool.request()
      .input('id', sql.Int, userId)
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('section', sql.NVarChar, section)
      .input('phone', sql.NVarChar, phone)
      .query(`
        UPDATE Users
        SET name = @name,
            email = @email,
            section = @section,
            phone = @phone
        WHERE id = @id
      `);

    res.json({ message: 'تم تحديث بيانات المستخدم بنجاح' });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء تحديث المستخدم' });
  }
});

// ✅ GET subjects by section
router.get('/subjects', async (req, res) => {
  const section = req.query.section;

  try {
    const pool = await poolPromise;

    const query = section
      ? 'SELECT * FROM Subjects WHERE section = @section'
      : 'SELECT * FROM Subjects';

    const request = pool.request();
    if (section) {
      request.input('section', sql.NVarChar, section);
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching subjects:', err);
    res.status(500).json({ error: 'Server error fetching subjects' });
  }
});

// DELETE subject by ID
router.delete('/subjects/:id', async (req, res) => {
  const { id } = req.params;
  const idNumber = parseInt(id, 10);

  if (isNaN(idNumber)) {
    return res.status(400).json({ message: 'معرف المادة غير صالح' });
  }

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, idNumber)
      .query('DELETE FROM subjects WHERE id = @id');

    res.json({ message: 'تم حذف المادة بنجاح' });
  } catch (err) {
    console.error('❌ Error deleting subject:', err);
    res.status(500).json({ message: 'فشل في حذف المادة' });
  }
});

router.post('/subjects', async (req, res) => {
  const { name, section } = req.body;

  if (!name || !section) {
    return res.status(400).json({ message: '❌ اسم المادة أو الشعبة مفقود' });
  }

  try {
    console.log("📥 Inserting subject:", name, section); // ✅ log input

    const pool = await poolPromise;

    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('section', sql.NVarChar, section)
      .query('INSERT INTO subjects (name, section) VALUES (@name, @section)');

    console.log("✅ Subject inserted successfully");

    res.json({ message: '✅ تمت إضافة المادة بنجاح' });

  } catch (error) {
    console.error("❌ DB Error:", error);
    res.status(500).json({ message: '❌ خطأ في الخادم أثناء إضافة المادة' });
  }
});


router.get('/stats/subjects', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT COUNT(*) AS total FROM Subjects');
    const totalSubjects = result.recordset[0].total;

    res.json({ total: totalSubjects });
  } catch (error) {
    console.error('Error fetching subject stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all pending payments
router.get('/payments', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        p.id, p.amount, p.method, p.status, p.createdAt, p.referenceCode,
        u.name, u.email
      FROM Payments p
      LEFT JOIN Users u ON p.userId = u.id  -- Changed to LEFT JOIN
      ORDER BY p.createdAt DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Confirm payment
router.post('/payments/:id/confirm', authenticateToken, async (req, res) => {
  const paymentId = parseInt(req.params.id, 10);

  if (isNaN(paymentId)) {
    return res.status(400).json({ 
      success: false,
      message: 'Invalid payment ID' 
    });
  }

  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    const request = new sql.Request(transaction);

    // 1. Get payment and verify status - using simple parameter name
    const paymentResult = await request
      .input('id', sql.Int, paymentId)
      .query(`
        SELECT p.userId, p.amount, p.status, u.wallet as currentBalance
        FROM Payments p
        INNER JOIN Users u ON p.userId = u.id
        WHERE p.id = @id
      `);

    if (paymentResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false,
        message: 'Payment not found' 
      });
    }

    const payment = paymentResult.recordset[0];

    if (payment.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: payment.status === 'success' 
          ? 'Payment already confirmed' 
          : 'Payment was refused'
      });
    }

    // 2. Update payment status - using different parameter name
    await request
      .input('pid', sql.Int, paymentId)
      .query(`UPDATE Payments SET status = 'success' WHERE id = @pid`);

    // 3. Update user wallet
    await request
      .input('uid', sql.Int, payment.userId)
      .input('amt', sql.Decimal(18, 2), payment.amount)
      .query(`UPDATE Users SET wallet = wallet + @amt WHERE id = @uid`);

    // 4. Calculate new balance
    const newBalance = (parseFloat(payment.currentBalance) + parseFloat(payment.amount)).toFixed(2);

    await transaction.commit();

    // 5. Return success response
    return res.json({
      success: true,
      message: 'تم تأكيد الدفع بنجاح',
      newBalance: newBalance
    });

  } catch (err) {
    console.error('Payment confirmation error:', err);
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      console.error('Transaction rollback failed:', rollbackErr);
    }
    return res.status(500).json({
      success: false,
      message: 'فشل في تأكيد الدفع',
      error: err.message
    });
  }
});

// Refuse payment
router.post('/payments/:id/refuse', authenticateToken, async (req, res) => {
  const paymentId = parseInt(req.params.id, 10);

  try {
    const pool = await poolPromise;

    // Ensure payment is pending
    const payment = await pool.request()
      .input('id', sql.Int, paymentId)
      .query("SELECT * FROM Payments WHERE id = @id AND status = 'pending'");

    if (payment.recordset.length === 0) {
      return res.status(400).json({ success: false, message: 'Payment not found or already processed' });
    }

    // Update status to refused
    await pool.request()
      .input('id', sql.Int, paymentId)
      .query("UPDATE Payments SET status = 'refused' WHERE id = @id");

    res.json({ success: true, message: 'تم رفض العملية بنجاح' });

  } catch (err) {
    console.error('Refuse error:', err);
    res.status(500).json({ success: false, message: 'فشل في رفض العملية' });
  }
});

module.exports = router;
