const express = require('express');
const router = express.Router();
const sql = require('mssql');
const dbConfig = require('../config/db'); // your DB config file
const { poolPromise } = require('../config/db');

router.post('/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('FullName', sql.NVarChar(100), name)
      .input('Email', sql.NVarChar(150), email)
      .input('Subject', sql.NVarChar(200), subject)
      .input('Message', sql.NVarChar(sql.MAX), message)
      .query(`
        INSERT INTO ContactMessages (FullName, Email, Subject, Message)
        VALUES (@FullName, @Email, @Subject, @Message)
      `);

    res.status(200).json({ success: true, message: 'تم إرسال الرسالة بنجاح' });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء الإرسال' });
  }
});

module.exports = router;
