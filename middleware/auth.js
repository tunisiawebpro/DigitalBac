const jwt = require('jsonwebtoken');
const sql = require('mssql');
const { poolPromise } = require('../config/db');

const secret = process.env.JWT_SECRET || 'yourSecretKey';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Confirm user exists
    const pool = await poolPromise;
    const userResult = await pool.request()
      .input('id', sql.Int, decoded.userId)
      .query('SELECT id FROM Users WHERE id = @id');

    if (!userResult.recordset.length) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = { userId: decoded.userId };
    return next();
  } catch (err) {
    console.error('Auth error:', err);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    
    return res.status(403).json({ message: 'Invalid token' });
  }
}

module.exports = { authenticateToken };