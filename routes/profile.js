const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { poolPromise } = require('../config/db');
const sql = require('mssql');
const router = express.Router();

// GET /api/profile
router.get('/profile', authenticateToken, async (req, res) => {
  console.log('req.user:', req.user);
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, req.user.userId)  // use userId from JWT
      .query('SELECT id, name, email, phone, section FROM Users WHERE id = @id'); // removed photo

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;