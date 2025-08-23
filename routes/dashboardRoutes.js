const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const { authenticateToken } = require('../middleware/auth');
const { poolPromise } = require('../config/db');

// Use just '/' here - the full path will be set when mounting
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('req.user:', req.user); // debug

    const userId = req.user.userId;

    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, userId)
      .query('SELECT name, email, section, phone, emailNotifications, appNotifications FROM Users WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;