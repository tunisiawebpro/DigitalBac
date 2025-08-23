const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { authenticateToken } = require('../middleware/auth');
const { poolPromise } = require('../config/db');
const nodemailer = require('nodemailer');

// =======================
// Update Notification Preferences
// =======================
router.post('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { emailNotifications, appNotifications } = req.body;

    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, userId)
      .input('emailNotifications', sql.Bit, emailNotifications ? 1 : 0)
      .input('appNotifications', sql.Bit, appNotifications ? 1 : 0)
      .query(`
        UPDATE Users
        SET emailNotifications = @emailNotifications,
            appNotifications = @appNotifications
        WHERE id = @id
      `);

    res.json({ success: true, message: 'Notification preferences updated successfully' });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ success: false, message: 'Server error while updating preferences' });
  }
});

// =======================
// Send Email Notification (Example)
// =======================
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { subject, message } = req.body;
    const userId = req.user.userId;

    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, userId)
      .query('SELECT name, email, emailNotifications FROM Users WHERE id = @id');

    const user = result.recordset[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.emailNotifications) {
      return res.status(400).json({ message: 'Email notifications are disabled for this user' });
    }

    // Nodemailer config
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Digital Bac" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: subject || 'إشعار جديد من Digital Bac',
      html: `<p>مرحباً <b>${user.name}</b>,</p>
             <p>${message || 'لديك إشعار جديد من منصة Digital Bac.'}</p>`
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: '✅ تم إرسال الإشعار عبر البريد الإلكتروني' });

  } catch (err) {
    console.error('Send notification error:', err);
    res.status(500).json({ success: false, message: 'Failed to send notification' });
  }
});

module.exports = router;
